# 市场风格 RPS 视图与文案调整 Spec

## Why
当前“市场风格 RPS”页面的视图优先级与说明文案不符合最新使用习惯，影响默认解读路径与信息聚焦。需要统一默认视图顺序并精简页面说明文字，降低认知负担。

## What Changes
- 调整视图顺序与默认视图：`Score 视图`置为第 1 位并作为默认；`RPS 起点归一`置为第 2 位；`原始视图`置为第 3 位。
- 移除页面上的仓位建议相关说明文字。
- 右上角不再展示“建议进攻仓位”“回退状态”两个字段。
- 将“判定”说明替换为新的 `Score 说明`文案（以 MA50 动量解释为核心）。

## Impact
- Affected specs: 市场风格 RPS 页面交互与信息展示
- Affected code: RPS 页面视图切换组件、右上角状态信息区、说明文案区域

## ADDED Requirements
### Requirement: Score 说明文案
系统 SHALL 在市场风格 RPS 页面提供统一的 `Score 说明`文案，替代原“判定”说明。

#### Scenario: 显示新文案
- **WHEN** 用户进入市场风格 RPS 页面并查看说明区域
- **THEN** 页面展示以下文案：
  `Score说明：Score数值较高，说明该标的在近期（以MA 50天为观察）动量水平较高，可能存在阶段性追涨机会，但需警惕回调）。Score数值较低，说明动量不足，但也有可能存在抄底机会。`

## MODIFIED Requirements
### Requirement: RPS 视图顺序与默认值
系统 SHALL 将市场风格 RPS 页签中的视图顺序调整为：第 1 位 `Score 视图`（默认）、第 2 位 `RPS 起点归一`、第 3 位 `原始视图`。

#### Scenario: 首次进入页面
- **WHEN** 用户首次进入市场风格 RPS 页面
- **THEN** 默认选中并展示 `Score 视图`
- **AND** 视图切换项顺序与上述定义一致

### Requirement: 右上角信息简化
系统 SHALL 在市场风格 RPS 页面右上角隐藏“建议进攻仓位”与“回退状态”两个字段。

#### Scenario: 页面渲染完成
- **WHEN** 页面完成渲染
- **THEN** 右上角不显示“建议进攻仓位”与“回退状态”字段

## REMOVED Requirements
### Requirement: 仓位建议相关说明文字
**Reason**: 页面信息简化，避免重复解释并降低视觉噪音。  
**Migration**: 删除原说明区对应文案，不影响数据计算与图表绘制逻辑。
