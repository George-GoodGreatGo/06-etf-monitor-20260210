# 市场风格RPS自定义查询三视图纵向对齐 Spec

## Why
当前“自定义查询”页虽然已经具备三图联动能力，但三视图没有按用户预期垂直并列展示，不利于按统一时间轴自上而下比较。需要参考“大盘看板”的阅读方式，将三视图改为纵向堆叠，并强化日期对齐体验。

## What Changes
- 将“自定义查询”页中的三张图表改为纵向堆叠展示，而非左右混排。
- 保持三张图使用统一的日期轴范围和日期对齐逻辑。
- 延续当前已实现的 hover 联动、十字光标同步和拖拽/缩放同步能力。
- 调整三图标题、容器和间距，使其更接近“大盘看板”的纵向阅读节奏。
- 保持已有指标、查询输入、成交额追踪与 RPS 计算口径不变。

## Impact
- Affected specs: 市场风格RPS自定义查询页三图布局、日期对齐与联动展示
- Affected code: `src/components/charts/RpsCustomQueryCharts.tsx`、必要时微调 `src/components/RpsStylePanel.tsx`

## ADDED Requirements
### Requirement: 三视图纵向并列
系统 SHALL 将自定义查询页中的三张图表按纵向顺序堆叠展示。

#### Scenario: 用户查看三图区域
- **WHEN** 用户进入“市场风格RPS > 自定义查询”
- **THEN** 前复权价格图、MA50归一视图、RPS起点归一视图按从上到下顺序展示
- **AND** 三图不再采用左右分栏混排

### Requirement: 三视图日期对齐
系统 SHALL 保持三张图在日期轴上的统一对齐，便于逐段比较。

#### Scenario: 用户观察同一日期
- **WHEN** 用户 hover、拖拽或缩放任意一张图
- **THEN** 其余两张图显示相同的日期位置
- **AND** 三图的可见区间保持一致

## MODIFIED Requirements
### Requirement: 自定义查询三图布局
系统 SHALL 将自定义查询页三图布局从“主图+侧栏副图”改为“纵向三联图”，同时保持现有同步交互能力不变。

#### Scenario: 布局改造完成后
- **WHEN** 用户查看三图区
- **THEN** 三图按统一宽度纵向排列
- **AND** 三图标题、图体和日期轴具有清晰的一致性
- **AND** 原有 hover 联动、拖拽和缩放能力继续可用

## REMOVED Requirements
### Requirement: 自定义查询三图采用左右分栏布局
**Reason**: 左右分栏不利于按统一时间轴连续比较三张图，用户更希望采用类似“大盘看板”的纵向阅读结构。  
**Migration**: 将原有三图区改为纵向堆叠，并保留原有图表数据与联动逻辑。
