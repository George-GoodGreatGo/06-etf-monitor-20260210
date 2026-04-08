# 低波机会：信号说明区与分位背景带 Spec

## Why
当前低波机会图表已引入“建议”与分位阈值背景带，但用户侧反馈未直观看到背景带，且“建议规则/指标定义”未在图表顶部形成统一说明区；同时低波机会 Tab 下需要对标大盘看板的“整体背景容器区域”承载图表与说明。

## What Changes
- 在“低波机会”Tab 下引入与大盘看板一致的背景容器区域，承载顶部说明/控制区 + 图表（主图与多副图）。
- 在图表顶部新增“统一说明区”，包含：
  - “建议”规则（阈值与组合条件）
  - 主图/副图各指标口径摘要（如股息收益率/利差/分位）
- 修复并增强“利差分位(10年)”背景带可见性：确保背景带作为图表叠加层显示在图表绘制层之上（但不影响交互），并随缩放/尺寸变化动态更新位置。

## Impact
- Affected specs: 低波机会信号展示与可解释性
- Affected code:
  - `src/components/LowVolOpportunityPanel.tsx`
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - 参考：`src/components/charts/MarketLiquidityChart.tsx`

## ADDED Requirements
### Requirement: 背景容器对标大盘看板
系统 SHALL 在“低波机会”Tab 下使用单一背景容器区域承载顶部说明/控制区与图表，视觉风格对齐大盘看板。

#### Scenario: 容器一致
- **WHEN** 用户查看大盘看板与低波机会
- **THEN** 两者图表承载区域的背景、边框、圆角、内边距一致或高度相似

### Requirement: 顶部统一说明区
系统 SHALL 在图表顶部（控制区附近）展示统一说明区，包含“建议规则”与“指标定义摘要”。

#### Content
- **建议规则（默认阈值）**
  - 偏配置：利差分位(10年) ≥ 80 且 BIAS分位(3年) ≤ 30
  - 偏减仓：利差分位(10年) ≤ 20 且 BIAS分位(3年) ≥ 70
  - 其他：偏观望/等待更好位置（按现有逻辑输出）
- **指标定义摘要（固定文案）**
  - 股息收益率：滚动1年（252交易日），由 PRI/TRI 推算
  - 利差（平滑）：spreadRaw 的 EWMA（半衰期6个月≈126交易日）
  - 利差分位：基于 spreadRaw 的 10 年滚动分位（window≈2520，minPeriods=252）

#### Scenario: 不遮挡
- **WHEN** 用户 hover 图表并触发 hover 面板
- **THEN** 顶部说明区不与 hover 面板重叠遮挡（必要时 hover 面板位置自动避让或顶部说明区可折叠）

### Requirement: 分位背景带可见且随缩放更新
系统 SHALL 在“利差分位(10年)”副图上渲染背景带：
- 80–100 区间：绿色背景
- 0–20 区间：红色背景

#### Rendering Rules
- 背景带 SHALL 作为图表叠加层显示在图表绘制层之上，但 `pointer-events: none` 不影响拖拽/hover。
- 背景带 SHOULD 避开右侧价格刻度区域（不覆盖刻度文字）。

#### Update Rules
- **WHEN** 图表尺寸变化、可视范围变化、价格刻度映射变化
- **THEN** 背景带位置与高度应重新计算并更新，保证与 0/20/80/100 的坐标对应。

