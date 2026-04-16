# 计划：RPS新Ticker覆盖率预热窗口最小改造

## 1. Summary
- 目标：按你确认的策略实施最小改动，仅在 `rows < 504` 时，计算 `score coverage` 前排除前 49 天 MA50 预热窗口，避免新 ticker 因天然空值误触发发布闸门。
- 约束：保持现有质量闸门框架与阈值 `SCORE_COVER_THRESHOLD=0.9` 不变，不放松成熟 ticker 的质量标准。
- 影响范围：仅 `server/scripts/refreshRpsStyleSnapshots.ts` 的覆盖率计算逻辑与质量摘要字段。

## 2. Current State Analysis
- 当前覆盖率实现：
  - `scoreCoverage(rows.slice(-504))` 直接以最近 504 行分母计算。
  - 闸门判定：`rows.length >= 200 && cover < 0.9` 则 fail。
- 问题根因：
  - `Score=(RPS/MA50-1)*100%`，MA50 前 49 个交易日必然无效（`score_pct=null`）。
  - 新增 ticker 历史较短时，49 个预热空值在分母中占比过高，导致 coverage 被低估（例如 `0.857`）。
- 现有容灾行为正常：
  - 失败后 `published=false`，自动回退 `fallbackRunId`，线上 run 不受影响。

## 3. Proposed Changes

### 3.1 新增“短样本预热排除”覆盖率口径（最小改动）
- 文件：`server/scripts/refreshRpsStyleSnapshots.ts`
- 改动：
  - 引入常量（示例命名）：
    - `SCORE_COVER_WINDOW = 504`
    - `SCORE_WARMUP_DAYS = 49`
  - 将每个 ticker 的 coverage 计算改为：
    1. 先取 `tailRows = rows.slice(-SCORE_COVER_WINDOW)`；
    2. 若 `rows.length < SCORE_COVER_WINDOW`，则使用 `tailRows.slice(SCORE_WARMUP_DAYS)` 作为 coverage 分母；
    3. 若 `rows.length >= SCORE_COVER_WINDOW`，保持原逻辑（不排除预热）。
  - 防御性处理：若排除后样本为空，coverage 按 `0` 处理，继续触发闸门保护。

### 3.2 闸门判定保持不变
- 文件：`server/scripts/refreshRpsStyleSnapshots.ts`
- 改动：
  - 保持 `rows.length >= 200 && cover < SCORE_COVER_THRESHOLD` 的 fail 条件不变。
- 目的：
  - 实现“只修正新 ticker 的预热偏差”，不改变成熟 ticker 质量要求。

### 3.3 质量摘要增强（便于排障）
- 文件：`server/scripts/refreshRpsStyleSnapshots.ts`
- 改动：
  - 在 `qualityByTicker` 增加覆盖率口径上下文（例如 `coverWindowRows`、`coverWarmupExcluded`、`coverEffectiveRows`）。
  - 日志中继续输出 `scoreCoverTail`，必要时补充 `effectiveRows` 以确认排除是否生效。
- 目的：
  - 让 CI 日志能直接解释“为何 coverage 改善/仍失败”。

## 4. Assumptions & Decisions
- 严格按你的策略：仅 `rows < 504` 才排除前 49 天预热；`rows >= 504` 一律沿用原口径。
- 本次不调整 0.9 阈值，不添加 ticker 白名单豁免，不改发布失败回退策略。
- 本次不修改 `server/lib/rpsStyle.ts` 的 MA50/Score 计算公式，仅改闸门统计口径。

## 5. Verification Steps
- 单点验证（本地或 CI 日志）：
  - 对短样本新 ticker（如 `512050.SH`）看到 `scoreCoverTail` 提升（预期从约 `0.857` 升至接近或高于阈值）。
  - `rows >= 504` 的成熟 ticker，coverage 与旧逻辑一致（无行为变化）。
- 结果验证：
  - 若覆盖率达标，本次 run 应 `published=true`；
  - 若仍不达标，应继续 `published=false` 且回退旧 run（保护机制保持）。
- 工程验证：
  - `npm run build` 通过；
  - 相关脚本文件无新增诊断错误。
