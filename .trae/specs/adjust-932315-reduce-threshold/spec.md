# 红利质量偏减仓阈值调整 Spec

## Why
红利质量（932315）的“偏减仓”触发过于敏感，需要提高 BIAS 分位阈值以减少误触发与过度切换。

## What Changes
- 为低波机会信号规则增加“按指数代码覆盖阈值”的能力
- 将 932315 的偏减仓阈值调整为：BIAS分位(3年) ≥ 95
- 其他指数继续使用现有全局阈值（当前为 79）
- UI 的规则说明/建议标签/hover 建议/主图分段颜色全部使用同一套“按指数阈值”逻辑

## Impact
- Affected specs: 低波机会二级导航建议标签、低波机会图表分段着色、hover 建议展示、规则说明文案
- Affected code:
  - src/utils/lowVolSignal.ts
  - src/pages/Home.tsx
  - src/components/LowVolOpportunityPanel.tsx
  - src/components/charts/LowVolOpportunityChart.tsx

## ADDED Requirements
### Requirement: 按指数覆盖偏减仓阈值
系统 SHALL 支持对低波机会信号阈值按指数代码进行覆盖。

#### Scenario: 932315 偏减仓阈值覆盖
- **WHEN** 用户查看红利质量（932315）信号计算
- **THEN** 系统使用偏减仓阈值：BIAS分位(3年) ≥ 95

#### Scenario: 其他指数保持全局阈值
- **WHEN** 用户查看 H30269 / 932365 信号计算
- **THEN** 系统继续使用全局偏减仓阈值：BIAS分位(3年) ≥ 79

## MODIFIED Requirements
### Requirement: 低波机会信号一致性
系统 SHALL 保证以下位置使用同一套阈值与规则计算“偏配置/偏减仓/偏观望/偏配置（等待更好位置）/—”：
- 二级导航的“操作建议”标签
- 面板右上角摘要卡的“建议”
- 图表 hover 浮层的“建议”
- 主图分段线条着色（红/绿/黄/蓝）
- 规则说明区域展示的阈值文案（需随所选指数变化）

## REMOVED Requirements
（无）

