# 低波机会图表对标大盘看板 UI Spec

## Why
当前低波机会图表已实现主图+多副图堆叠与日期联动，但容器、留白、统一 hover 提示区、以及顶部控制区的交互样式仍与「大盘看板」不一致。需要对标大盘看板的 UI 规范，统一视觉与交互习惯，降低用户学习成本。

## What Changes
- 在低波机会 Tab 下引入与大盘看板一致的图表容器样式（背景、边框、圆角、信息区排版）。
- 调整主图/副图/副图之间的间隙与分隔样式，形成与大盘看板一致的视觉节奏。
- 新增统一的 hover 指标提示区（单一信息面板），在 hover 任意图时展示同一日期的主图与各副图指标值。
- 将“指标展示/副图展示控制”上移到图表顶部控制区，交互样式对齐大盘看板（可显示/可隐藏）。

## Impact
- Affected specs: 低波机会图表展示与交互
- Affected code:
  - `src/components/LowVolOpportunityPanel.tsx`
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - 参考实现：`src/components/charts/MarketLiquidityChart.tsx`

## ADDED Requirements
### Requirement: 低波图表容器对标看板
系统 SHALL 使用与大盘看板一致的容器结构承载低波图表。

#### Scenario: 视觉一致
- **WHEN** 用户切换到「低波机会」与「大盘看板」
- **THEN** 图表区背景色、边框、圆角、标题/说明区布局风格一致

### Requirement: 主/副图间距与分隔
系统 SHALL 在主图与各副图、以及副图之间提供与大盘看板一致的间隙（gap）与分隔线样式。

#### Scenario: 视觉节奏
- **WHEN** 页面渲染主图与 4 条副图
- **THEN** 各图之间存在稳定一致的间距，不显拥挤且不影响阅读

### Requirement: 统一 Hover 信息面板
系统 SHALL 提供单一 hover 信息面板，展示当前十字光标日期对应的指标值集合。

#### Scenario: Hover 任意图
- **WHEN** 用户在任意一张图上移动十字光标
- **THEN** 统一 hover 面板展示：
  - 日期
  - 指数点位（close、MA250）
  - BIAS(250)
  - BIAS 分位(3年)
  - 利差（平滑）
  - 利差分位(10年)

### Requirement: 顶部控制区（对标看板）
系统 SHALL 在图表顶部提供控制区，用于控制主图指标与副图显示/隐藏。

#### Scenario: 控制副图显示/隐藏
- **WHEN** 用户关闭某条副图（例如“利差分位(10年)”）
- **THEN** 对应副图不再占用高度，其他图保持日期联动与 hover 面板正常
- **WHEN** 用户重新开启该副图
- **THEN** 副图恢复显示并继续联动

#### Scenario: 控制主图指标显示/隐藏
- **WHEN** 用户关闭 MA250
- **THEN** 主图仅显示 close 线
- **WHEN** 用户开启 MA250
- **THEN** MA250 线恢复显示

## MODIFIED Requirements
### Requirement: 日期对齐与联动保持不变
系统 SHALL 保持现有主/副图日期对齐、可视范围同步、十字光标联动逻辑不变，且对隐藏的副图不执行同步。

