# 市场风格RPS切换至H30269基准 Spec

## Why
当前“市场风格RPS”页面的实际计算分母仍绑定 `512890.SH`，而页面部分元数据又引用 `H30269`，存在展示口径与计算口径不一致的问题。
将基准统一替换为“红利低波全收益指数（H30269）”，可以让页面说明、接口元数据与RPS计算逻辑保持一致。

## What Changes
- 将“市场风格RPS”的实际计算基准从 `512890.SH` 切换为 `H30269`
- 将页面中所有“红利低波ETF”“512890.SH 基准”“红利低波指数”等基准相关文案统一替换为“红利低波全收益指数（H30269）”
- 调整接口返回字段与说明信息，使基准标识、名称和代码均反映 `H30269`
- 补充回归验证，确保三种图表视图、截面数据与说明文案在切换基准后仍保持可用

## Impact
- Affected specs: 市场风格RPS视图与成交额追踪
- Affected code: `server/lib/rpsStyle.ts`、`server/routes/rpsStyle.ts`、`src/components/RpsStylePanel.tsx`、`src/components/charts/RpsStyleChart.tsx`、`src/utils/marketApi.ts`、`server/tests/rpsStyleTurnover.test.ts`

## ADDED Requirements
### Requirement: 市场风格RPS统一使用H30269作为基准
系统 SHALL 在“市场风格RPS”模块中，以“红利低波全收益指数（H30269）”作为统一基准来源，并保证计算、接口元数据和页面文案一致。

#### Scenario: RPS数据按H30269计算
- **WHEN** 服务端生成 RPS 截面数据、趋势序列或相关元数据
- **THEN** 分母基准使用 `H30269`
- **THEN** 返回结果中的基准代码、名称和说明不再指向 `512890.SH` 或“红利低波ETF”

#### Scenario: 前端展示H30269基准说明
- **WHEN** 用户打开“市场风格RPS”页面并查看说明文案、图例或基准标签
- **THEN** 页面展示“红利低波全收益指数（H30269）”作为基准
- **THEN** 不再出现“相对红利低波ETF基准”“512890.SH=1”这类旧基准文案

## MODIFIED Requirements
### Requirement: 市场风格RPS趋势对比展示
系统 SHALL 保留现有 `Score 视图`、`RPS 起点归一` 与 `原始视图` 的切换方式，但所有视图均基于“红利低波全收益指数（H30269）”生成和标注。

#### Scenario: 视图切换时基准保持一致
- **WHEN** 用户在三种图表视图之间切换
- **THEN** 各视图共享同一 `H30269` 基准
- **THEN** 图例、说明和基准标签与计算结果保持一致

## REMOVED Requirements
### Requirement: 使用512890.SH作为市场风格RPS统一基准
**Reason**: 旧方案将 ETF 行情作为统一分母，与当前目标的指数基准口径不一致，且页面已存在 `H30269` 元数据，易造成理解偏差。
**Migration**: 将所有基准常量、接口字段说明、前端标签及测试断言从 `512890.SH / 红利低波ETF` 迁移到 `H30269 / 红利低波全收益指数`。
