# 低波/价值副图开关联动修复 Spec

## Why
当前【低波机会】【价值择时】在副图关闭后再次开启时，存在偶发“副图无数据、光标不同步、TIPS不更新”的问题，而【大盘看板】同类交互正常。需要对齐稳定实现，避免用户误判数据异常。
在上一轮修复后，仍出现“首次关闭再开启无数据，第二次开关后恢复”的回归现象，说明首次重开路径仍存在时序缺口，需要在同一能力下做补丁级收敛。
最新反馈显示问题进一步呈现“奇偶次开关交替失败”：第一次重开无数据、第二次恢复、第三次再次无数据，说明当前补偿逻辑中仍有状态残留或队列清理不彻底，需继续根因修复。

## What Changes
- 修复低波/价值图表在副图开关后的数据回灌与时序同步问题
- 对齐大盘看板的联动实践：可见范围同步、crosshair 同步、异常保护
- 增加联动临界区保护，避免一次异常导致后续 hover/TIPS 永久失效
- 增加副图实例存在性保护，避免开关时序导致整轮刷新中断
- 增加“首次重开”专用恢复策略：当首轮可见范围/尺寸尚未稳定时，进行延迟重放与一次性回灌确认
- 修复补偿队列与可见状态快照残留，确保每次开关都独立可恢复，不受上一次开关影响
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

### Requirement: 首次重开一致性保障
系统 SHALL 在“首次关闭再开启副图”场景下，保证首轮就完成数据与视窗同步，不依赖第二次开关恢复。

#### Scenario: 首次重开立即可见
- **WHEN** 用户第一次关闭某副图并立刻重新开启
- **THEN** 该副图在本次开启即显示数据，且与主图时间窗口一致
- **AND** 不需要再次关闭/开启才能恢复

### Requirement: 多次开关一致性保障
系统 SHALL 在连续多轮关闭/开启副图操作下保持一致表现，不出现“奇偶次交替失败”。

#### Scenario: 连续三次开关
- **WHEN** 用户连续执行三轮“关闭副图 -> 开启副图”
- **THEN** 每一轮开启后都应立即显示数据
- **AND** 不出现“第一轮失败、第二轮成功、第三轮失败”的交替模式

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

### Requirement: 首轮开关时序补偿
系统 SHALL 在副图从隐藏切换为显示后的首个渲染周期内，执行可见范围与数据回灌的补偿同步（例如下一帧/尺寸稳定后重放），避免首轮丢数。

#### Scenario: 首次开启时主图range暂不可用
- **WHEN** 副图首次重开时主图可见范围暂不可用或尺寸未稳定
- **THEN** 系统应在后续可用时自动补偿同步
- **AND** 最终表现与大盘看板一致（首轮可见、可联动）

### Requirement: 补偿状态生命周期隔离
系统 SHALL 对补偿重放队列、开关前状态快照、同步锁状态进行严格生命周期管理，确保一次开关的补偿状态在完成后被清理，不污染下一次开关。

#### Scenario: 上一轮补偿已结束
- **WHEN** 上一轮开关补偿流程结束并进入下一轮开关
- **THEN** 新一轮应从干净状态开始计算与执行补偿
- **AND** 不应复用上轮失效的 range/raf 队列或可见性快照

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次为稳定性修复，不移除既有能力
**Migration**: 不涉及迁移
