# 低波机会操作建议规则重定义 Spec

## Why
现有“操作建议”阈值与文案经过多轮迭代后存在不一致与理解成本。需要统一为一套清晰、固定的规则，并在图表中完整展示定义。

## What Changes
- 统一“操作建议”的规则与优先级为 5 条（缺失 / 偏加仓 / 偏减仓 / 偏持有 / 偏观望）
- 将“偏减仓”阈值统一为：BIAS分位(3年) ≥ 85（所有指数一致）
- 将“偏配置”文案统一替换为“偏加仓/偏持有”，并在二级导航、摘要卡、hover、主图分段着色中一致呈现
- 在图表“建议规则”区域展示完整规则定义（含缺失规则与 4 种颜色映射）
- 移除/停用任何按指数覆盖阈值的特殊逻辑（例如 932315 的 95 覆盖）**BREAKING**

## Impact
- Affected specs: 二级导航建议标签、面板摘要卡建议、图表 hover 建议、主图分段颜色、图表“建议规则”说明区
- Affected code:
  - src/utils/lowVolSignal.ts
  - src/pages/Home.tsx
  - src/components/LowVolOpportunityPanel.tsx
  - src/components/charts/LowVolOpportunityChart.tsx

## ADDED Requirements
### Requirement: 完整规则展示
系统 SHALL 在低波机会图表的“建议规则”区域展示完整的 5 条规则定义，并标明颜色含义（绿/红/黄/蓝）。

#### Scenario: 查看规则定义
- **WHEN** 用户打开低波机会图表且“说明/规则”处于展开状态
- **THEN** 用户可看到完整的规则定义（含缺失规则与 4 色对应）

## MODIFIED Requirements
### Requirement: 操作建议统一规则（全局）
系统 SHALL 按以下优先级生成“操作建议”（同一套逻辑用于二级导航、摘要卡、hover、主图分段着色）：
1. 数据缺失（原规则）：当利差分位(10年)缺失/非数字时，建议为 “—”
2. 偏加仓（绿色）：利差分位(10年) ≥ 80 且 BIAS分位(3年) ≤ 20
3. 偏减仓（红色）：BIAS分位(3年) ≥ 85
4. 偏持有（黄色）：利差分位(10年) ≥ 80 且 未触发 2 且 未触发 3
5. 其他：偏观望（蓝色）

## REMOVED Requirements
### Requirement: 按指数覆盖阈值
**Reason**: 规则需全局统一，避免不同指数阈值导致解释困难与不可比。
**Migration**: 删除或停用 indexCode 的阈值覆盖表；所有指数使用同一套阈值（其中偏减仓阈值为 85）。

