# 页面标题改为 ETF MONITOR AI Spec

## Why
当前页面在浏览器标签中显示为旧标题，与站点当前品牌文案不一致，影响识别与统一性。需要将页面展示标题统一为 `ETF MONITOR AI`。

## What Changes
- 将页面展示的标题文案统一改为 `ETF MONITOR AI`。
- 覆盖应用入口常见标题来源（如 HTML `title`、运行时动态设置标题）。
- 保持页面其他导航文案与功能行为不变。

## Impact
- Affected specs: 站点品牌文案一致性、页面标题展示规则
- Affected code: 前端应用入口与标题设置相关文件（如 `index.html`、标题管理逻辑）

## ADDED Requirements
### Requirement: 页面标题统一文案
系统 SHALL 在页面展示位置（浏览器标签页标题）使用统一文案 `ETF MONITOR AI`。

#### Scenario: 首次加载标题正确
- **WHEN** 用户首次打开站点页面
- **THEN** 浏览器标签页标题显示为 `ETF MONITOR AI`

#### Scenario: 路由切换后标题保持一致
- **WHEN** 用户在站内进行路由切换并停留在默认页面场景
- **THEN** 浏览器标签页标题仍为 `ETF MONITOR AI`（除非页面存在明确且已定义的差异化标题规则）

## MODIFIED Requirements
### Requirement: 站点标题文案
系统 SHALL 将原页面展示标题替换为 `ETF MONITOR AI`，并确保不再回退到旧标题文案。

## REMOVED Requirements
### Requirement: 旧页面标题文案
**Reason**: 旧文案已不符合当前品牌命名。
**Migration**: 将所有页面标题来源中的旧文案替换为 `ETF MONITOR AI`，并通过手工验收确认。
