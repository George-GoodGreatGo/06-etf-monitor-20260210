# 大盘看板 Tab 图标与默认视窗（720日）优化 Spec

## Why
当前首页 Tab 区域中“大盘看板”使用圆点标识，不够直观；且进入大盘看板后默认展示全量历史，信息密度偏高，不利于聚焦近期趋势。需要在不牺牲交互（拖拽缩放查看更长历史）的前提下，提升首屏可读性与一致性。

## What Changes
- 首页 Tab 区域：
  - 将“大盘看板”Tab 的圆点标识替换为更形象的图标（与现有 Tab 的“图标 + 文案”结构一致）。
- 大盘看板主图默认视窗：
  - 当用户首次进入“大盘看板”Tab 时，主图默认聚焦最近 720 个交易日数据（默认只改变初始可视范围，不裁剪数据）。
  - 用户仍可通过拖拽/缩放查看更长历史数据（可视范围可被用户交互覆盖，后续不强制回跳）。

## Impact
- Affected specs: 首页 Tab 视觉与大盘看板默认浏览体验
- Affected code:
  - `src/pages/Home.tsx`（Tab 图标替换）
  - `src/components/charts/MarketLiquidityChart.tsx`（主图初始可视范围设定与联动）

## ADDED Requirements
### Requirement: 大盘看板 Tab 使用图标
系统 SHALL 为“大盘看板”Tab 提供图标标识，替代现有圆点。

#### Scenario: Tab 一致性
- **WHEN** 用户查看首页 Tab 区域
- **THEN** “TOP200 列表 / AI 解读 / 大盘看板”均以“图标 + 文案”的一致结构呈现
- **AND** 图标在激活/未激活状态下具有清晰的颜色区分，与现有 Tab 视觉体系一致

### Requirement: 默认展示最近 720 日
系统 SHALL 在进入大盘看板时，默认将主图可视范围设置为最近 720 个交易日（或不足 720 则展示全部）。

#### Scenario: 初次进入大盘看板
- **GIVEN** 大盘看板拥有超过 720 个交易日数据
- **WHEN** 用户切换到“大盘看板”Tab 且图表完成数据写入
- **THEN** 主图默认可视范围为最近 720 个交易日
- **AND** 副图（流动性/股债）时间轴与主图保持联动一致

#### Scenario: 支持查看更长历史
- **WHEN** 用户在主图上拖拽/缩放查看更长历史
- **THEN** 可正常查看更长历史数据，不被强制拉回最近 720 个交易日

## MODIFIED Requirements
N/A

## REMOVED Requirements
N/A
