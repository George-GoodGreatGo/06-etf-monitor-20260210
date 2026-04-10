# 低波机会主图新增 MA60（SMA）Spec

## Why
低波机会主图目前仅展示指数价格与 MA250。新增 60 日均线（SMA）可更直观地观察中期趋势与回撤结构，辅助“加仓/持有/观望/减仓”的执行节奏。

## What Changes
- 在“低波机会”Tab 下所有指数（H30269/932365/932315）的主图增加 60 日简单移动均线（SMA60）
- 在主图控制区增加 SMA60 的显示开关（与 SMA250 并列）
- 在 hover 浮层中补充 SMA60 数值展示（当 SMA60 开启时）
- 主图右上角标题文案随开关动态显示（例如“指数（主图） + SMA60 + SMA250”）
- 明确口径：现有 MA250 为 250 日 SMA（不是 EMA），MA60 与之保持一致为 60 日 SMA
- 命名统一：页面上不再使用 “MA60/MA250” 文案，统一标记为 “SMA60 / SMA250”

## Impact
- Affected specs: 低波机会图表主图指标展示、hover 信息面板、顶部控制区
- Affected code:
  - src/components/charts/LowVolOpportunityChart.tsx
  - （默认）前端基于 close 计算 MA60 并渲染；不要求后端接口变更

## ADDED Requirements
### Requirement: MA60 指标展示
系统 SHALL 在低波机会主图展示 SMA60（窗口=60 个交易日数据点）。

#### Scenario: MA60 默认展示
- **WHEN** 用户进入“低波机会”Tab 并加载任一指数图表
- **THEN** 主图显示指数线与 SMA60（并保持现有的 SMA250 行为不变）

#### Scenario: 关闭 MA60
- **WHEN** 用户在控制区关闭 SMA60
- **THEN** 主图隐藏 SMA60，hover 浮层不再展示 SMA60 数值

## MODIFIED Requirements
### Requirement: 主图指标一致性
系统 SHALL 保持主图指标计算口径一致：
- SMA60 为 close 的 60 点简单均值
- 当可用数据点少于 60 时，对应日期的 SMA60 不展示（即不输出该点）
- 现有 SMA250 为 close 的 250 点简单均值，SMA60 与其一致

## REMOVED Requirements
（无）
