# Top200 ETF 页新增 RPS 分析入口 Spec

## Why
当前用户在 `Top200 ETF 异动监测` 列表中发现目标 ETF 后，如果还想进一步看该标的相对 `H30269` 的 RPS 走势，需要再手动进入“自定义查询”并重复输入代码，路径较长。
需要在列表页提供直接跳转入口，并让目标页自动带入该 ETF 代码发起查询，缩短从“发现标的”到“继续分析”的操作链路。
入口已补齐后，当前 `RPS分析` 按钮的文案、列标题与视觉样式仍不够统一：表头没有对应字段名，按钮文案也与“进入分析页”的结果态不一致，影响表格整体观感与可读性。

## What Changes
- 在 `Top200 ETF 异动监测` 列表每一行的右侧操作区新增一个 `RPS分析` 按钮，与现有 `查看` 入口并列
- 点击 `RPS分析` 后，新开窗口跳转到 `/market/rps/custom-query`，并通过 URL 参数携带当前行 ETF 代码
- “自定义查询”页在首次进入时识别 URL 中的 ETF 代码参数，并自动请求该代码的 RPS 查询结果
- 当 URL 中没有有效 ETF 代码参数时，保留当前“自定义查询”页的默认查询行为，不破坏既有手动查询体验
- 在表格顶部为该入口补充独立列标题 `RPS分析`
- 将该列按钮文案从 `RPS分析` 调整为 `查看`
- 将该列 `查看` 按钮样式与现有 `异动详情` 按钮样式保持一致，提升表格视觉统一性

## Impact
- Affected specs: `Top200 ETF 异动监测`, `市场风格RPS自定义查询`
- Affected code: `src/components/Top100Table.tsx`, `src/pages/MarketRpsCustomQuery.tsx`, `src/components/RpsStylePanel.tsx`

## ADDED Requirements
### Requirement: Top200 列表提供 RPS 分析入口
系统 SHALL 在 `Top200 ETF 异动监测` 列表每条 ETF 记录的右侧操作区提供 `RPS分析` 按钮，使用户可直接对当前行 ETF 发起 RPS 深入分析。

#### Scenario: 从列表行打开 RPS 分析
- **WHEN** 用户在 `Top200 ETF 异动监测` 列表中点击某一行的 `RPS分析`
- **THEN** 浏览器新开一个窗口或标签页
- **AND** 目标地址进入 `/market/rps/custom-query`
- **AND** 地址中携带当前 ETF 的代码参数

### Requirement: 自定义查询页支持 URL 参数自动查询
系统 SHALL 让“自定义查询”页在首次加载时识别 URL 中传入的 ETF 代码参数，并自动请求该代码的 RPS 查询结果。

#### Scenario: 带代码参数进入页后自动请求
- **GIVEN** 用户通过带有 ETF 代码参数的 URL 进入“自定义查询”页
- **WHEN** 页面完成首次初始化
- **THEN** 查询输入框显示该 ETF 代码
- **AND** 页面自动发起对应代码的查询请求
- **AND** 成功返回后展示该 ETF 对应的摘要、图表和成交额结果

#### Scenario: 缺少代码参数时保留默认行为
- **GIVEN** 用户直接进入“自定义查询”页，且 URL 中没有有效 ETF 代码参数
- **WHEN** 页面完成首次初始化
- **THEN** 页面继续保持当前默认查询行为
- **AND** 不因为缺少参数而报错、空白或阻塞用户手动查询

## MODIFIED Requirements
### Requirement: Top200 列表操作列命名与样式一致
系统 SHALL 让 `Top200 ETF 异动监测` 列表中的 RPS 跳转入口具备独立表头、清晰文案和一致样式，避免与 `异动详情` 列形成视觉割裂。

#### Scenario: 表头展示独立字段名
- **WHEN** 用户查看 `Top200 ETF 异动监测` 列表表头
- **THEN** RPS 跳转入口所在列显示独立字段名 `RPS分析`
- **AND** `异动详情` 列继续保留原有独立表头

#### Scenario: RPS 列按钮文案调整为查看
- **WHEN** 用户查看任意一行的 RPS 跳转入口
- **THEN** 该按钮文案显示为 `查看`
- **AND** 按钮语义对应“查看该 ETF 的 RPS 分析结果”

#### Scenario: RPS 列按钮样式与异动详情一致
- **WHEN** 用户同时查看 `RPS分析` 列与 `异动详情` 列中的按钮
- **THEN** 两者采用一致的按钮视觉样式、尺寸与层级
- **AND** 不因样式调整破坏原有新开窗口跳转能力

### Requirement: 自定义查询页的初始化查询优先级
系统 SHALL 在“自定义查询”页初始化时，优先使用 URL 传入的 ETF 代码参数；只有在 URL 未提供有效代码时，才回退到当前默认查询逻辑。该初始化优先级仅作用于首次进入页，不得妨碍用户后续手动修改代码并重新查询。

#### Scenario: URL 参数覆盖默认代码
- **WHEN** 页面首次进入时同时存在默认代码逻辑和 URL 代码参数
- **THEN** 页面优先采用 URL 中的 ETF 代码执行首次查询
- **AND** 不再额外触发默认代码的重复请求

#### Scenario: 用户手动查询不被初始化逻辑覆盖
- **WHEN** 页面已完成首次初始化，且用户手动输入新代码并点击查询
- **THEN** 页面展示用户最新查询的结果
- **AND** 初始化阶段的 URL 参数处理不再重复覆盖当前查询状态

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次为跨页入口增强，不移除既有能力
**Migration**: 不涉及迁移
