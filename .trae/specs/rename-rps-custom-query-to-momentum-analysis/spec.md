# 将 RPS 自定义查询改名为动量分析 Spec

## Why
当前左侧二级菜单与页面主标题仍使用“自定义查询”“ETF自定义查询（RPS）”文案，和页面实际承载的动量分析定位相比不够直观。需要将用户可见入口统一改名为“动量分析”，降低理解成本并统一表达。

## What Changes
- 将左侧“市场风格RPS”下的二级菜单文案 `自定义查询` 改为 `动量分析`。
- 将 RPS 独立页中的页面级标题 `ETF自定义查询（RPS）` 改为 `动量分析`。
- 将该页面面包屑中的当前页文案从 `自定义查询` 改为 `动量分析`。
- 保持页面路由、功能逻辑、接口调用与图表交互行为不变。

## Impact
- Affected specs: 市场风格RPS 导航命名一致性、RPS 独立页标题展示规则
- Affected code: `src/components/SideNav.tsx`、`src/pages/MarketRpsCustomQuery.tsx`、`src/components/RpsStylePanel.tsx`

## ADDED Requirements
### Requirement: 动量分析统一命名
系统 SHALL 在市场风格 RPS 的自定义查询独立页相关用户可见入口统一使用 `动量分析` 文案。

#### Scenario: 菜单入口显示新名称
- **WHEN** 用户展开左侧 `市场风格RPS` 二级菜单
- **THEN** 原 `自定义查询` 菜单项显示为 `动量分析`

#### Scenario: 页面标题显示新名称
- **WHEN** 用户进入原自定义查询独立页
- **THEN** 页面主标题显示为 `动量分析`

#### Scenario: 面包屑显示新名称
- **WHEN** 用户查看该页面顶部面包屑
- **THEN** 当前页层级文案显示为 `动量分析`

## MODIFIED Requirements
### Requirement: 市场风格RPS 独立页命名
系统 SHALL 将原先面向用户展示的 `自定义查询`、`ETF自定义查询（RPS）` 命名替换为 `动量分析`，并确保相关入口文案保持一致。

## REMOVED Requirements
### Requirement: 自定义查询旧文案
**Reason**: 旧文案无法准确体现页面作为 ETF 动量分析入口的定位，且与当前信息架构命名不统一。
**Migration**: 将菜单、面包屑和页面主标题中的旧文案统一替换为 `动量分析`，并通过页面回归确认无遗漏。
