# ETF自定义查询搜索与图表控制增强 Spec

## Why
当前“ETF自定义查询”页的顶部搜索栏颜色偏暗，首屏入口不够醒目，用户容易忽略。前复权价格主图也缺少更短周期均线与可控的指标/副图开关，导致用户无法像在“大盘看板”中那样按需聚焦主图信号与副图信息。

## What Changes
- 提亮“ETF自定义查询”顶部搜索栏的默认态、hover 和 focus 视觉层级，让输入框在深色主题下更易辨识
- 在前复权价格主图新增 `SMA20` 曲线，并与现有 `SMA60`、`SMA250`、价格主线共同展示
- 参考“大盘看板”为主图增加指标控制项，允许用户切换主图中各指标的显示状态
- 参考“大盘看板”为副图增加显示/隐藏开关，允许用户按需折叠或恢复各副图
- 保持现有 hover 日期、十字光标、可见范围同步与数据提示行为不回退
- 对齐“大盘看板”的稳定实践：副图开关仅控制可见性与联动集合，不因隐藏而丢失数据

## Impact
- Affected specs: `市场风格RPS自定义查询`
- Affected code: `src/components/RpsStylePanel.tsx`, `src/components/charts/RpsCustomQueryCharts.tsx`, `src/pages/MarketRpsCustomQuery.tsx`, `src/utils/marketApi.ts`

## ADDED Requirements
### Requirement: 搜索栏高可见性
系统 SHALL 将“ETF自定义查询”顶部搜索栏调整为更明亮、可快速识别的深色主题搜索入口，并在默认态、hover、focus 态保持清晰的边界与层级。

#### Scenario: 首屏搜索入口更醒目
- **WHEN** 用户进入“ETF自定义查询”页面并尚未操作搜索框
- **THEN** 搜索栏在页面首屏中应明显区别于背景与周边容器
- **AND** 输入区域与查询按钮都保持足够的可辨识度

#### Scenario: 搜索态反馈清晰
- **WHEN** 用户 hover 或 focus 搜索栏
- **THEN** 搜索栏应进一步增强高亮、边框、背景或阴影反馈
- **AND** 不破坏当前暗色主题的一致性

### Requirement: 前复权价格主图支持 SMA20
系统 SHALL 在“ETF自定义查询”前复权价格主图中新增 `SMA20` 曲线，用于补充短周期趋势参考，并与现有价格线和中长期均线保持同日期对齐。

#### Scenario: 查询成功后显示 SMA20
- **WHEN** 用户查询某个 ETF 且成功返回历史价格序列
- **THEN** 前复权价格主图显示价格主线
- **AND** 同图叠加 `SMA20`
- **AND** `SMA20` 与 `SMA60`、`SMA250`、价格线共用相同日期轴与 hover 联动

### Requirement: 主图指标控制项
系统 SHALL 参考“大盘看板”在图表顶部提供主图指标控制项，使用户可以按需显示或隐藏主图中的指标线。

#### Scenario: 关闭某条主图指标线
- **WHEN** 用户在主图指标控制区关闭 `SMA20`
- **THEN** 主图不再显示 `SMA20` 曲线
- **AND** 其他已开启的价格线、均线与标记保持正常显示

#### Scenario: 重新开启主图指标线
- **WHEN** 用户重新开启 `SMA20` 或其他主图指标
- **THEN** 对应曲线应立即恢复显示
- **AND** 不影响当前视窗范围、hover 日期与其他图表联动

### Requirement: 副图显示与隐藏开关
系统 SHALL 参考“大盘看板”为“ETF自定义查询”的副图提供独立显示/隐藏开关，使用户可以按需折叠或恢复各副图。

#### Scenario: 关闭副图
- **WHEN** 用户关闭某个副图
- **THEN** 该副图不再占用垂直高度
- **AND** 主图与其他仍可见副图继续保持日期联动和 hover 提示正常

#### Scenario: 重新开启副图
- **WHEN** 用户重新开启此前隐藏的副图
- **THEN** 该副图应恢复显示并继续参与联动
- **AND** 不需要重新查询数据

## MODIFIED Requirements
### Requirement: 自定义查询图表联动与可见性管理
系统 SHALL 在新增主图指标控制与副图显示开关后，继续保持“ETF自定义查询”现有的可见范围同步、十字光标同步、hover 日期与数据提示能力；隐藏的副图不参与联动计算，但其数据状态应保留，重新显示时可直接恢复。

#### Scenario: 开关后联动保持稳定
- **WHEN** 用户执行主图指标显示切换或副图显示/隐藏切换
- **THEN** 图表不会出现日期错位、hover 失效或联动中断
- **AND** 当前可见图表之间仍保持稳定同步

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次为增强与交互补充，不移除既有能力
**Migration**: 不涉及迁移
