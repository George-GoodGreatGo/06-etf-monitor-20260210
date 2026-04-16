# 副图开关联动失效与数据丢失修复计划（稳定优先）

## Summary
- 目标：修复低波机会/价值择时中“副图关闭再开启后联动失效、TIPS不更新、副图偶发无数据”的问题；并顺带复核大盘图表同类风险点。
- 成功标准：
  - 副图任意开关顺序下，主图与副图十字光标联动正常；
  - TIPS 日期与数值持续更新；
  - 副图开关后不出现“首次空白、再次开关才恢复”的异常；
  - lint/check 继续通过，不引入 warning/error。
- 约束：以稳定性为优先，只做图表联动与数据绑定链路修复，不改指标口径和后端接口。

## Current State Analysis

### 1) 低波/价值共用图表链路（问题主战场）
- 相关文件：
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - `src/components/charts/ValueTimingChart.tsx`（转接到 LowVolOpportunityChart）
  - `src/components/LowVolOpportunityPanel.tsx`
  - `src/components/ValueTimingPanel.tsx`
- 现状观察（基于代码）：
  - 联动订阅 effect 按“当前可见副图”动态组装 `charts` 集合；当集合退化时会提前 `return`，可能留下 hover/订阅状态不一致窗口。
  - `setData` effect 使用 `if (!main || !bias || !biasPct || !spread || !spreadPct) return` 的全量依赖门槛，任一副图句柄短时为空会导致全批数据绑定跳过，出现“副图重开后缺线”。
  - 多个副图的可见性由 `height` 与 `opacity` 切换控制，实际 chart 实例不销毁；若在切换瞬间错过数据/联动同步，容易出现“只有一图响应”。

### 2) 大盘图表同类风险点（需复核）
- 相关文件：`src/components/charts/MarketLiquidityChart.tsx`
- 现状观察：
  - 存在同样的“按可见面板动态组装 charts + crosshair/range 订阅”的模式；
  - 若依赖更新顺序不当，理论上也可能出现联动残留或背景区更新滞后，需要做一致性复核（优先只读检查 + 轻量保护性修复）。

## Proposed Changes

### Phase A：修复低波/价值的数据绑定门槛（防止副图重开无数据）
- 文件：`src/components/charts/LowVolOpportunityChart.tsx`
- 做法：
  - 将“全量句柄都存在才 setData”的早退逻辑改为“按单图句柄逐项 setData”，不因某个副图临时为空而跳过其它图的数据刷新。
  - 对副图开关相关的 `setData` 保持幂等：关闭时写入空数组，开启时立即回灌当前 `data`。
- Why：直接消除“首次重开副图无数据，再开关一次才恢复”的根因。

### Phase B：修复联动订阅与 hover 生命周期（防止只剩单图响应）
- 文件：`src/components/charts/LowVolOpportunityChart.tsx`
- 做法：
  - 重构 crosshair/range 联动 effect：保证每次 show/hide 变更都完成“先解绑旧订阅，再按当前可见图完整重绑”。
  - 在 `charts.length <= 1` 或副图集合变化时，显式重置 hover/跨图光标状态，避免 stale 状态锁住 TIPS。
  - 对 `setCrosshairPosition` 的目标 series 做存在性与当前可见性双重校验，未满足时统一 `clearCrosshairPosition`。
- Why：解决“关闭再开启后只能单图响应、日期不联动、TIPS不更新”。

### Phase C：价值择时链路验证与适配
- 文件：
  - `src/components/charts/ValueTimingChart.tsx`
  - `src/components/ValueTimingPanel.tsx`
- 做法：
  - 验证 ValueTiming 通过映射层进入 LowVolOpportunityChart 的数据完整性（`bias/biasPct/spread/spreadPct` 字段）。
  - 若映射中存在空值/字段缺失边界，补上最小防御（仅类型与空值兜底，不改业务口径）。
- Why：低波与价值共用图表逻辑，需确保价值侧不被映射层放大问题。

### Phase D：大盘图表同类问题复核（必要时最小修复）
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 做法：
  - 对照低波修复策略检查“数据绑定门槛、订阅解绑重绑、hover/reset”三点。
  - 仅在确认存在同类缺陷时做最小改动（不做行为扩展）。
- Why：满足“顺带复核大盘”的要求，同时控制改动面。

## Assumptions & Decisions
- 决策：优先修复共用图表组件 `LowVolOpportunityChart`，因为低波与价值问题同源。
- 决策：不改 UI 交互定义（开关按钮、布局、文案不变），仅修复联动和数据刷新的时序与条件。
- 决策：大盘只做同类风险复核与必要最小修补，避免额外回归。
- 假设：你反馈的“第3条”对应“副图线条消失 + TIPS不更新”，并已纳入本次范围。

## Verification Steps

### 功能验证（手工）
- 低波机会：
  - 连续执行：关 `BIAS` -> 开 `BIAS` -> 关 `BIAS分位` -> 开 `BIAS分位` -> 关 `利差分位` -> 开 `利差分位`；
  - 每一步确认：副图有线、十字光标跨图联动、TIPS日期与数值持续变化。
- 价值择时：
  - 同上流程，且切换 `BIAS基准(SMA250/SMA60)` 后重复验证一次。
- 大盘（复核项）：
  - 面板开关与 hover 联动、背景区更新保持正常。

### 静态验证
- `npm run lint` 通过（0 error/0 warning 维持）。
- `npm run check` 通过。
- 改动文件 VS Code diagnostics 无新增错误。

## Out Of Scope
- 不修改后端接口/缓存逻辑。
- 不调整指标定义、阈值与口径。
- 不新增功能，仅修复稳定性缺陷。
