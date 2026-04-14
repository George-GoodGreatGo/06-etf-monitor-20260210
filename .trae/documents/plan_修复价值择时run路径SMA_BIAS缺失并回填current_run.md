# 修复价值择时 run 路径 SMA/BIAS 缺失并回填 current_run 计划

## Summary
- 目标：修复“价值择时”在 `source=supabase:value_timing_index_point` 时仍不展示 `SMA60/SMA250/BIAS/BIAS分位` 的问题。
- 根因：现有动态补算仅覆盖 snapshot fallback 分支，未覆盖 run 读取分支。
- 方案：采用“读时补算 + 一次性 SQL 回填 current_run（Supabase）”双保险。
- 口径：保持 `SMA60 + SMA250`，BIAS 分位窗口保持当前实现（5年滚动）。

## Current State Analysis
- 前端已具备展示能力：
  - `src/components/charts/ValueTimingChart.tsx` 将 value 字段映射到 `LowVolOpportunityChart`，依赖 `ma60/ma250/bias*/biasPct*` 字段。
  - `src/components/ValueTimingPanel.tsx` 已传入 `biasBasis` 并在图表/hover 使用。
- 后端数据读取路径差异：
  - `server/lib/valueTiming.ts` 的 `getValueTimingIndexSnapshotSeries()`：
    - run 分支：`getValueIndexSeriesFromSupabaseRuns()` 直接返回 `rows.map(mapPointRowToDailyPoint)`；
    - snapshot fallback 分支：已接入 `hydrateValueTimingSeriesWithDerivedMetrics()` 补算。
- 因此当 current run 来自历史迁移数据且 `value_timing_index_point` 中 `ma/bias/bias_pct` 为空时：
  - source 显示为 `supabase:value_timing_index_point`；
  - 前端图表/hover 仍无对应曲线（与用户现象一致）。
- 迁移文件 `supabase/migrations/0012_value_timing_run_model.sql` 是从旧 payload 搬运字段，若旧 payload 本身缺失这些字段，run 表会保留空值。

## Proposed Changes

### 1) run 读取路径增加动态补算（立即生效）
- 修改文件：`server/lib/valueTiming.ts`
- 具体改动：
  - 在 `getValueIndexSeriesFromSupabaseRuns()` 里，对 `rows.map(mapPointRowToDailyPoint)` 的结果执行 `hydrateValueTimingSeriesWithDerivedMetrics(...)`。
  - 返回时采用补算后的 `series`。
  - 在 `notes` 增加可观测标记（如 `derived_from_run=1`、`derived_fields=...`），仅在实际补算发生时追加。
- 目的：即使 current run 表字段缺失，API 也能返回完整 `SMA/BIAS/分位`，前端立刻恢复展示。

### 2) 一次性 SQL 回填 current_run（固化数据）
- 交付产物：
  - 提供可在 Supabase SQL Editor 执行的回填 SQL（按 `value_timing_meta.current_run_id` 作用范围，避免误更新历史 run）。
- 回填逻辑（SQL）：
  - 使用窗口函数按 `code,data_date` 计算：
    - `ma60/ma250`：滚动均线；
    - `bias60/bias250`：`(close-ma)/ma`；
    - `bias_pct_3y_60/bias_pct_3y`：在 1260 窗口内按分位计算（不足阈值保持 null）；
    - `spread_pct_rank_5y`：对 `spread_pct` 做 5 年滚动分位。
  - 仅更新当前 run 且目标列为 null 的行（保留已有有效值）。
- 目的：让数据库里 current run 字段真实完整，降低读时补算压力与二次排障成本。

### 3) 轻量测试补充
- 修改文件：`server/tests/valueTimingSnapshotHydration.test.ts`（或新增 run 路径测试文件）
- 覆盖点：
  - run 行为模拟：输入缺 `ma/bias` 的序列，补算后返回存在 `ma60/ma250/bias60/bias250`。
  - 保留已有值策略：已有非空字段不被覆盖。

### 4) 验证步骤
- 代码验证：
  - `npm run check`
  - `npm run test:unit`
- 数据验证（Supabase）：
  - 回填前后对比（以 current_run_id 为条件）：
    - `ma60 is not null`、`ma250 is not null`
    - `bias250 is not null`
    - `bias_pct_3y is not null`
- 业务验收：
  - `/market?tab=value` 下确认：
    - 主图出现 `SMA60/SMA250`
    - `BIAS` 与 `BIAS分位` 子图有曲线
    - hover 展示对应值
  - `source` 仍可为 `supabase:value_timing_index_point`，但展示恢复正常。

## Assumptions & Decisions
- 已确认决策：
  - 修复策略：`run 读时补算 + SQL 回填 current_run`。
  - 回填方式：Supabase SQL Editor 执行 SQL。
- 假设：
  - current run 至少具备 `code/data_date/close`，可完成 SMA 与 BIAS 计算。
  - 回填 SQL 仅针对 current run，不变更历史 run。

## Verification Steps
1. 完成代码修改后，调用 `/api/value/index/:code`，抽查返回中 `ma60/ma250/bias*/biasPct*` 不再全空。
2. 在 Supabase 执行回填 SQL 前后，分别统计 current run 非空率，确认明显提升。
3. 打开 `/market?tab=value` 进行 UI 验收（图表+hover）。
4. 运行 `npm run check` 与 `npm run test:unit`，确保无新增阻断性问题。
