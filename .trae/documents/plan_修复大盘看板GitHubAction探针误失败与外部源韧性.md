# 计划：修复大盘看板 GitHub Action 探针误失败与外部源韧性

## 1. Summary
- 目标：修复 `refresh-market-board` 定时任务在外部源短时波动下频繁失败的问题（日志中的 `northbound empty`、`yield10y This operation was aborted`）。
- 核心策略（已确认）：
  - `probe` 改为软门禁继续跑（不因单源短时失败立即退出）。
  - 提升 `chinamoney` 超时/重试强度。
  - `northbound` 增加扩大探测窗口兜底。
- 约束：不放松最终发布质量门禁（覆盖率与新鲜度检查仍为最终拦截器）。

## 2. Current State Analysis
- 失败触发点：
  - `server/scripts/refreshMarketBoardPoints.ts` 的 `runSourceConnectivityProbe()` 使用 `Promise.allSettled` 后，当前逻辑是“任一源失败即 throw”，导致回灌在开头直接退出。
  - 当前 hard fail 条件在 `okCount < checks.length`。
- northbound 现状：
  - `server/lib/hkex.ts` 的 `fetchNorthboundTotalTurnoverSeries()` 对 `返回数据为空` 直接返回空数组。
  - `probe` 里将空数组视作错误 `northbound empty`，仅重试 2 次，窗口固定 1 年。
- yield10y 现状：
  - `server/lib/chinamoneyGovBond.ts` 使用 `fetchWithTimeout()` + `AbortController`，超时上限受 `Math.min(..., 60_000)` 限制。
  - `fetchYearXlsx()` 默认最大 5 次，递增超时至 45s；日志显示全部 `aborted` 后失败。
- workflow 现状：
  - `.github/workflows/refresh-market-board.yml` 当前未显式下发 `CHINAMONEY_*` 调优环境变量，依赖默认参数。
- 结论：
  - 当前是“探针阶段过于刚性 + 外部源抖动未兜底”，导致任务误失败，而不是业务数据逻辑错误。

## 3. Proposed Changes

### A. 将 probe 从硬门禁改为软门禁（但保留关键源约束）
- 文件：`server/scripts/refreshMarketBoardPoints.ts`
- 变更：
  - `runSourceConnectivityProbe()` 改为返回结构化结果（成功/失败明细），不直接因单项失败 `throw`。
  - 仅 `hs300_pe` 作为关键必需源：若失败则立即终止；`northbound` 与 `yield10y` 失败仅记 warning。
  - 在 backfill 主流程中记录 `probeSummary` 到日志与 `qualitySummary`，便于追踪。
- 原因：
  - 满足“软门禁继续跑”要求，避免第三方短时抖动导致早退。

### B. northbound 探针增加“扩大窗口”兜底
- 文件：`server/scripts/refreshMarketBoardPoints.ts`
- 变更：
  - probe 的 northbound 从“仅探测 1 年”改为分级兜底：
    - 第一次：1 年窗口；
    - 若 empty：自动扩大到 3 年；
    - 仍 empty：扩大到 5 年后再判定失败。
  - 日志明确输出每级窗口结果（count）。
- 原因：
  - 避免接口短期空窗或近一年缺口导致误判。

### C. 提升 chinamoney 超时与重试弹性
- 文件：`server/lib/chinamoneyGovBond.ts`
- 变更：
  - `fetchWithTimeout()` 的上限由 `60_000` 提升（例如到 `120_000`，并可由环境变量控制）。
  - `fetchYearXlsx()` 默认 `maxAttempts` 提升（如 `5 -> 6/7`），保留指数退避与抖动。
  - 对 `AbortError` 与 HTML 网关异常分类日志，便于区分“网络超时”与“上游网关”。
- 文件：`.github/workflows/refresh-market-board.yml`
- 变更：
  - 为 job 注入可调环境变量（示例）：
    - `CHINAMONEY_FETCH_MAX_ATTEMPTS`
    - `CHINAMONEY_FETCH_BASE_DELAY_MS`
    - `CHINAMONEY_FETCH_TIMEOUT_MAX_MS`（新增后在代码中消费）
  - 先采用保守增强值，避免过长阻塞。
- 原因：
  - 按你的偏好提升重试强度，降低 `aborted` 失败概率。

### D. 失败策略与发布安全阀保持
- 文件：`server/scripts/refreshMarketBoardPoints.ts`
- 变更：
  - 保持现有最终质量门禁不变：
    - `max_date` 新鲜度检查；
    - 覆盖率阈值检查（`COVERAGE_THRESHOLD`）。
  - 若最终门禁失败，仍不发布新 run，并回写 failed 状态（现有逻辑保留）。
- 原因：
  - 软化探针但不牺牲发布质量，避免脏数据上线。

## 4. Assumptions & Decisions
- 已确认决策：
  - probe 采用软门禁继续跑（推荐策略）。
  - 提升 chinamoney 超时与重试强度。
  - northbound 增加窗口扩大兜底。
- 设计边界：
  - 不改 Supabase 表结构。
  - 不改前端接口协议。
  - 不降低最终发布质量门槛。

## 5. Verification Steps
- 单次回归（手动触发 workflow）：
  - 观察 `probe` 日志：若 northbound/yield10y 临时失败，任务不应在 probe 阶段直接退出。
  - 观察窗口兜底日志：northbound empty 时应出现 1y -> 3y -> 5y 探测链路。
- 结果验证：
  - 若后续分段计算与覆盖率通过，应发布新 `visible_run`。
  - 若最终质量门禁不通过，应 fail 且不切 current run。
- 技术验证：
  - `npm run check` 通过。
  - 新增代码路径在日志中可见 `probeSummary` 与失败分类信息，便于后续定位。
