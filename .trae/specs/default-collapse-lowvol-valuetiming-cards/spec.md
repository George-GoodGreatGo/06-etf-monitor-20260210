# 低波机会/价值择时指数卡片默认折叠 Spec

## Why
当前"低波机会"（12 张指数卡片占 3 行）和"价值择时"（3 张指数卡片占 1 行）的指数选择卡片默认全部展开，展示描述文字，占用较多屏幕空间。用户进入页面后更关注下方的图表和指标数据，折叠卡片可显著提升浏览效率。

## What Changes
- 将 `isCardsExpanded` 状态的默认值从 `true` 改为 `false`，使得低波机会和价值择时的指数选择卡片默认处于收起状态
- 收起状态下：卡片 padding 缩小（`py-1.5`）、描述文字隐藏、仅展示代码/标签/信号/股息率
- 用户仍可点击"展开说明"按钮随时展开

## Impact
- Affected specs: 低波机会指数选择器、价值择时指数选择器
- Affected code:
  - `src/pages/Home.tsx`：`isCardsExpanded` 初始值从 `useState(true)` 改为 `useState(false)`
  - 无需修改任何渲染逻辑、组件或 API

## MODIFIED Requirements
### Requirement: 指数卡片默认折叠
系统 SHALL 在用户进入"低波机会"或"价值择时"tab 时，将指数选择卡片默认为收起状态（仅显示代码、标签、信号和关键指标），用户可点击"展开说明"按钮展开查看描述文字。

#### Scenario: 首次进入低波机会
- **WHEN** 用户首次进入"低波机会"tab（页面加载后首次点击侧边栏或刷新页面）
- **THEN** 指数选择卡片呈收起状态，padding 缩小，描述文字隐藏
- **AND** 卡片上仍显示指数代码、名称标签、交易信号徽章、股息率

#### Scenario: 首次进入价值择时
- **WHEN** 用户首次进入"价值择时"tab
- **THEN** 指数选择卡片呈收起状态

#### Scenario: 展开说明
- **WHEN** 卡片收起状态下用户点击"展开说明"按钮
- **THEN** 卡片展开，padding 增大，描述文字显示
- **AND** 按钮切换为"收起说明"

#### Scenario: 收起说明
- **WHEN** 卡片展开状态下用户点击"收起说明"按钮
- **THEN** 卡片收起，恢复默认折叠态

#### Scenario: 跨 tab 切换
- **WHEN** 用户在低波机会收起卡片后切换到价值择时
- **THEN** 价值择时卡片同样呈收起状态（两个 tab 共用折叠状态，行为一致）

## REMOVED Requirements
无
