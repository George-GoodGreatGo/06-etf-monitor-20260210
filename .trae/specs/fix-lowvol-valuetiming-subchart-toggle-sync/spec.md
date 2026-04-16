# 低波/价值副图开关联动修复 Spec

## Why
当前【低波机会】【价值择时】在副图关闭后再次开启时，存在偶发“副图无数据、光标不同步、TIPS不更新”的问题，而【大盘看板】同类交互正常。需要对齐稳定实现，避免用户误判数据异常。

## What Changes
- 修复低波/价值图表在副图开关后的数据回灌与时序同步问题
- 对齐大盘看板的联动实践：可见范围同步、crosshair 同步、异常保护
- 增加联动临界区保护，避免一次异常导致后续 hover/TIPS 永久失效
- 增加副图实例存在性保护，避免开关时序导致整轮刷新中断
- **BREAKING**: 无

## Impact
- Affected specs: `low-vol-index-opportunity-identification`, `add-value-timing-module`, `adjust-market-board-rolling-window-5y`（仅参考其交互实践，不改业务口径）
- Affected code:
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - `src/components/charts/ValueTimingChart.tsx`
  - `src/components/charts/MarketLiquidityChart.tsx`（仅同类风险最小复核）

## ADDED Requirements
### Requirement: 副图开关后数据连续可见
系统 SHALL 在副图关闭再开启后，保证副图曲线可见且与当前主图时间范围一致。

#### Scenario: 低波机会副图重开成功
- **WHEN** 用户关闭任一副图（BIAS/BIAS分位/利差平滑/利差分位）后再次开启
- **THEN** 该副图在当前视窗立即显示有效数据，不出现“首次空白”

#### Scenario: 价值择时副图重开成功
- **WHEN** 用户在价值择时中执行同样开关操作
- **THEN** 副图同样立即恢复数据展示

### Requirement: 光标与TIPS联动持续有效
系统 SHALL 在副图开关任意顺序下，持续保持主副图 crosshair 联动与 TIPS 更新。

#### Scenario: 联动不因开关中断
- **WHEN** 用户反复开关副图并移动鼠标
- **THEN** 主图与可见副图的光标位置与日期一致，TIPS 数值持续更新

## MODIFIED Requirements
### Requirement: 图表联动同步鲁棒性
系统 SHALL 将图表联动（可见范围同步、crosshair 同步）实现为“可恢复”临界区：即便单次同步发生异常，也必须恢复后续交互能力。

#### Scenario: 单次同步异常后可恢复
- **WHEN** 联动过程中出现单次运行时异常
- **THEN** 同步状态应在本轮结束后被复位，后续 hover/TIPS 仍可正常工作

### Requirement: 副图对象调用安全性
系统 SHALL 在副图对象调用（`applyOptions`、`setVisibleLogicalRange`、`setCrosshairPosition`）前执行实例与数值有效性检查。

#### Scenario: 副图切换临界时序
- **WHEN** 副图处于关闭/开启切换瞬间
- **THEN** 系统仅对可用实例执行调用，不因空对象中断整轮刷新

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次为稳定性修复，不移除既有能力
**Migration**: 不涉及迁移
