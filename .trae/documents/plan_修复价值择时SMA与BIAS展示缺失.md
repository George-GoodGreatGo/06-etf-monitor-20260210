# 修复价值择时 SMA/BIAS 展示缺失实施计划

## Summary
- 目标：修复“价值择时”板块中 `SMA60/SMA250/BIAS/BIAS分位` 在图表与悬浮信息中不展示的问题。
- 已确认口径：使用 `SMA60 + SMA250`（不改为 260）。
- 已确认范围：覆盖“图表 + hover 悬浮信息”，不扩展右侧摘要卡新增字段展示。
- 已确认策略：当接口回退到旧快照且缺少相关字段时，由后端动态补算（兜底）后再返回前端，确保立即可见。

## Current State Analysis
- 前端形态现状：
  - `src/components/charts/ValueTimingChart.tsx` 已复用 `LowVolOpportunityChart`，并会把 `ma60/ma250/bias60/bias250/biasPct3y60/biasPct3y` 映射传入。
  - `src/components/ValueTimingPanel.tsx` 已传入 `biasBasis`，图表与 hover 的显示能力取决于数据是否存在。
- 前端类型现状：
  - `src/utils/marketApi.ts` 的 `ValueTimingPoint` 已包含 `ma60/ma250/bias60/bias250/biasPct3y60/biasPct3y`。
- 后端接口现状（关键）：
  - `server/lib/valueTiming.ts` 中：
    - run 表读取路径（`getValueIndexSeriesFromSupabaseRuns`）可返回这些字段；
    - 但当 run 不可用时会回退旧快照（`getValueTimingIndexSnapshotSeries` 的 `catch` 分支），直接透传历史 payload。
  - 历史 payload 可能不含 `ma60/ma250/bias*/biasPct*`，导致前端图表与 hover 无可显示数据。
- 用户当前症状与代码一致：不是组件渲染能力缺失，而是回退数据形态缺字段。

## Proposed Changes

### 1) 在 value 接口回退路径加入动态补算兜底
- 修改文件：`server/lib/valueTiming.ts`
- 变更点：
  - 新增“旧快照序列标准化 + 指标补算”函数（例如：`hydrateValueTimingSeriesWithDerivedMetrics`）：
    - 输入：旧快照 `series`（至少包含 `date/close`，可选 `pe/yield10y`）。
    - 计算并回填：`ma60/ma250/bias60/bias250/biasPct3y60/biasPct3y`。
    - 若 `spreadPctRank5y` 缺失且 `spreadPct` 可用，则按现有 5 年滚动规则补算。
  - 在 `getValueTimingIndexSnapshotSeries` 的 snapshot fallback 分支，对 `full/series` 执行上述补算后再返回。
  - 在 `meta.notes` 增加可观测标记（如 `derived_from_snapshot=1`、`derived_fields=ma,bias,bias_pct`）。
- 原因：
  - 不依赖 run 发布成功即可恢复展示；
  - 不改变前端组件结构，最小改动实现可见性恢复。

### 2) 增强数据健壮性（避免补算被脏数据中断）
- 修改文件：`server/lib/valueTiming.ts`
- 变更点：
  - 序列标准化阶段过滤非法点（无 date、close 非数值、日期乱序）。
  - 按日期升序去重，保障 rolling 计算稳定。
  - 对既有值采取“保留优先”：若快照已带字段且合法，则不覆盖；仅对缺失项补算。
- 原因：历史快照结构可能不一致，需确保补算在异常输入下也能稳定返回。

### 3) 前端最小兼容（仅在需要处）
- 预期无需结构改动；若发现 hover 仍因空值不显示，则仅做最小兜底：
  - 修改文件（按需）：`src/components/charts/ValueTimingChart.tsx`
  - 确认映射字段名与 `LowVolOpportunityChart` 预期完全一致（当前已一致）。
- 原因：保持修复重心在后端数据形态，避免重复改 UI 逻辑。

### 4) 验证与回归
- 代码级验证：
  - 针对 `server/lib/valueTiming.ts` 增加/更新单测，覆盖“旧快照缺字段 -> 动态补算后有值”的用例。
- 运行验证：
  - `npm run check`
  - `npm run test:unit`（必要时增加 value 专项测试入口）
- 功能验收：
  - 访问 `/market?tab=value`，确认：
    - 图表区可显示 `SMA60/SMA250`；
    - BIAS 面板与 BIAS 分位面板有数据曲线；
    - hover 可显示对应 `BIAS` 与 `BIAS分位`；
    - `biasBasis` 切换（SMA250/SMA60）后展示项联动正常。

## Assumptions & Decisions
- 决策已锁定：
  - 均线口径：`SMA250`（非 `SMA260`）。
  - 修复范围：图表 + hover。
  - 策略：后端接口动态补算兜底。
- 假设：
  - 历史快照至少包含有效 `date/close`，可完成均线与 BIAS 计算。
  - 不要求本次同步修改“右侧摘要卡”的字段展示。

## Verification Steps
1. 在本地运行接口（或联调环境）并请求 `/api/value/index/:code`，抽查返回体已包含：
   - `ma60/ma250`
   - `bias60/bias250`
   - `biasPct3y60/biasPct3y`
2. 打开 `/market?tab=value`：
   - 图表可见 SMA 线；
   - BIAS 与 BIAS 分位副图有曲线；
   - hover 中 `BIAS(60/250)` 与 `BIAS分位(5年)` 正常显示。
3. 切换 `biasBasis`：
   - `sma250` 与 `sma60` 两种模式下数据联动正确。
4. 执行 `npm run check` 与 `npm run test:unit` 通过，且未引入新增阻断性报错。
