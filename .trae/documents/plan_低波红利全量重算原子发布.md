# 低波红利全量重算原子发布改造计划

## Summary
- 目标：将“低波红利（lowvol）”刷新链路升级为与“大盘看板”一致的**全量重算 + 原子发布 + 失败回退**模式。
- 约束与决策：
  - 仅改造低波红利栏目（不含价值择时）。
  - 存储采用 `run_id` 双表模型（数据点位表 + meta 表）。
  - 发布粒度为“整批一次发布”：所有低波指数全部通过校验才切换。
  - 严格校验，最新数据日允许最大滞后 14 天。
  - 定时刷新每次固定从 `2016-01-01` 开始全量重算。

## Current State Analysis
- 前端读取：
  - `src/pages/Home.tsx` 在 `tab=lowvol` 时先请求 `/api/lowvol/summary`，再按选中指数请求 `/api/lowvol/index/:code`。
  - `src/components/LowVolOpportunityPanel.tsx` 消费返回的 `meta + series`。
- 后端读取：
  - `server/routes/lowVol.ts` 的 `/summary`、`/index/:code` 都从快照读取。
  - `server/lib/lowVol.ts` 通过 `getLowVolSummary()`、`getLowVolIndexSnapshotSeries()` 读取 Supabase 最新快照。
  - `server/lib/supabaseRest.ts` 当前使用 `lowvol_index_daily`，按 `(code, data_date)` upsert；不具备 run 版本隔离与原子切换能力。
- 刷新脚本：
  - `server/scripts/refreshLowVolSnapshots.ts` 现为“冷启动 + 增量计算”策略，非每次从固定起点全量重算。
  - GitHub Action `refresh-lowvol-snapshots.yml` 在北京时间 20:00~21:59 每 15 分钟触发。
- 对照实现（参考样板）：
  - `server/scripts/refreshMarketBoardPoints.ts` 已实现 run_id 新 run、质量校验、`publishMarketBoardRun` 原子切换、失败保留旧 run、保留最近 5 个 run。
  - `supabase/migrations/0008_market_board_meta_run_history.sql` 与 `0009_market_board_publish_run_rpc.sql` 提供了 run 元数据与原子发布 RPC 机制。

## Proposed Changes

### 1) Supabase Schema（新增 lowvol 的 run 模型）
- 文件：`supabase/migrations/0011_lowvol_run_model.sql`（新建）
- 变更内容：
  - 新增表 `public.lowvol_index_point`（建议字段）：
    - 主键/唯一键：`(run_id, code, data_date)`
    - 字段：`run_id`, `code`, `data_date`, `fetched_at`, `source_type`, `source`, `notes`, 指标列（close/ma/bias/dividend/yield/spread/rank），`updated_at`
  - 新增表 `public.lowvol_meta`（单行 id=`default`）：
    - `current_run_id`, `previous_run_id`, `history_run_ids`(jsonb), `current_data_date`, `publish_status`, `quality_summary`, `updated_at`
  - 新增 RPC：`public.publish_lowvol_run(...)`
    - 原子更新 `lowvol_meta` 到新 run
    - 删除 `lowvol_index_point` 中不在 `keep_run_ids` 的历史 run 数据
  - RLS/只读策略：
    - 匿名读取仅允许 `current_run_id + history_run_ids` 范围（与大盘看板策略一致）。
- 原因：
  - 为“先写新 run，校验通过后再切换可见数据”提供数据库原子保障。

### 2) Supabase 访问层扩展
- 文件：`server/lib/supabaseRest.ts`
- 变更内容：
  - 新增类型：
    - `LowVolIndexPointRow`
    - `LowVolMetaRow`
  - 新增方法：
    - `upsertLowVolIndexPoints(payload[])`
    - `readLowVolMeta()`
    - `publishLowVolRun({ nextRunId, previousRunId, keepRunIds, currentDataDate, publishStatus, qualitySummary })`
    - `readLowVolIndexPointsRange({ code, startDate, endDate, runId? })`
  - 保留旧接口（`readLatestLowVolIndexSnapshot*`, `upsertLowVolIndexSnapshot`）用于迁移过渡，后续再清理。
- 原因：
  - 把 run 发布能力下沉到统一数据访问层，便于脚本与 API 复用。

### 3) lowvol 读取改造（从“快照表”切到“run可见集”）
- 文件：`server/lib/lowVol.ts`
- 变更内容：
  - 新增 `getLowVolIndexSeriesFromSupabaseRuns({ code, startDate, endDate })`：
    - 读取 `lowvol_meta.history_run_ids` 候选 run，按顺序尝试可用 run。
    - 可用性校验：
      - 日期序列单调、无重复
      - 关键字段有效率（至少对 close、spreadPct、dividendYieldPct 做检查）
      - 最新日期滞后不超过 14 天（与发布标准一致/或更宽松只作读兜底）
    - 候选 run 全不可用时，回退读取“当前可见范围（不指定 runId）”兜底，避免前端空白。
  - 将 `getLowVolIndexSnapshotSeries()` 的内部读取切换到 run 模型（保留函数名或重命名并更新路由）。
  - `getLowVolSummary()` 也改为基于“当前可见 run 数据”汇总而非旧快照。
- 文件：`server/routes/lowVol.ts`
  - 无接口变更，保持 `/api/lowvol/index/:code` 与 `/api/lowvol/summary` 返回结构兼容。
- 原因：
  - 前端无感升级，读取永远是“已发布版本”；未通过校验的新 run 不会污染线上可见数据。

### 4) 刷新脚本改造（全量重算 + 原子发布）
- 文件：`server/scripts/refreshLowVolSnapshots.ts`（改名或保留原名）
- 变更内容：
  - 固定起始：`FULL_BACKFILL_START = '20160101'`，每次任务对全部 lowvol 支持指数全量重算到今日。
  - 计算方式：复用 `getLowVolIndexSeries({ code, startDate, endDate })`（实时计算函数）。
  - 写入流程（新 run）：
    1. 生成 `runId`。
    2. 对所有指数逐个计算并写入 `lowvol_index_point(run_id=runId)`。
    3. 汇总质量检查（整批）：
      - 每个指数有数据且末日不超 14 天滞后
      - 最近窗口关键字段覆盖率达阈值（严格门槛）
      - 无空序列/无日期异常
    4. 全部通过后调用 `publishLowVolRun(...)` 原子切换。
    5. `keepRunIds` 保留最近 5 次（含新 run）。
  - 失败策略：
    - 任一指数失败或校验失败：不发布新 run，`lowvol_meta` 保持当前 run，记录 `publish_status='failed'` 与错误摘要。
  - 运行策略：
    - 保留现有 GH 调度窗口（20:00~22:00，每 15 分钟），但每次执行为全量模式。
    - 防抖与重试可沿用现有随机 sleep + retry 机制，避免上游限流/WAF。
- 原因：
  - 严格实现“要么全部更新，要么继续上一版”的一致性目标。

### 5) GitHub Action 对齐
- 文件：`.github/workflows/refresh-lowvol-snapshots.yml`
- 变更内容：
  - 保留当前 cron 与手动触发结构。
  - 将脚本运行模式显式标记为“full backfill publish”（通过 env 或参数），避免误走旧增量分支。
  - 输出关键日志字段：`run_id`, `prev_run_id`, `published`, `keep_runs`, `max_data_date`, `coverage`。
- 原因：
  - 便于线上排障与审计发布状态。

### 6) 兼容与迁移步骤
- 文件：`server/lib/lowVol.ts`, `server/lib/supabaseRest.ts`, `server/routes/lowVol.ts`
- 执行策略：
  - 第 1 阶段：双写/双读开关（可选，若需平滑）。
  - 第 2 阶段：读取切到 run 模型；旧快照只兜底（短期）。
  - 第 3 阶段：确认稳定后移除旧表读写逻辑（后续单独任务）。
- 原因：
  - 降低一次性切换风险，保障线上可用性。

## Assumptions & Decisions
- 已确认决策：
  - 仅低波红利栏目。
  - run_id 双表模型。
  - 整批原子发布（全部指数通过才切换）。
  - 严格校验并允许最大滞后 14 天。
  - 每次定时任务固定从 2016-01-01 全量重算。
- 假设：
  - Supabase 允许新增 lowvol 相关表/RPC 与对应 RLS 策略。
  - 现有 lowvol 指数集合以 `getLowVolSupportedIndexCodes()` 为准。
  - 前端无需 API 字段变更（保持兼容）。

## Verification Steps
1. Migration 验证
- 在本地或测试库执行新 migration，确认：
  - 新表/索引/RPC 创建成功；
  - RLS 规则生效且匿名仅能读可见 run。

2. 脚本发布链路验证（手动触发）
- 执行一次全量任务，检查日志：
  - 生成新 `run_id`；
  - 每个指数写入完成；
  - 校验通过后 `publish_lowvol_run` 成功；
  - `history_run_ids` 长度不超过 5；
  - 旧 run 数据按 keep 列表清理。

3. 失败回退验证
- 人为制造单指数失败（或mock上游错误）：
  - 脚本应报失败并保持 `current_run_id` 不变；
  - 前端读取结果仍为上一次已发布数据。

4. API 回归验证
- `GET /api/lowvol/summary` 与 `GET /api/lowvol/index/:code`：
  - 返回结构与前端现有类型兼容；
  - 前端低波卡片与图表无改动可正常展示。

5. 新鲜度与质量验证
- 验证 `quality_summary` 包含：
  - 各指数 `max_data_date`、覆盖率、失败原因（若有）；
  - 末日滞后检查按 14 天阈值执行。

