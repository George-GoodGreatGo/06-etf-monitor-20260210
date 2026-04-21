# 市场风格RPS显示精度提升 Spec

## Why
在“市场风格RPS”切换到 `H30269` 基准后，目标 ETF 的 `RPS` 与 `MA50` 数值量级明显变小，当前表格仅显示 4 位小数时，多个标的会呈现为接近 `0` 的视觉效果。
这会削弱截面数据的可读性，用户难以直观看出不同 ETF 之间的细微差异，因此需要提升显示精度，但不改变底层计算逻辑。

## What Changes
- 提升“市场风格RPS”页面中 `RPS` 与 `MA50` 的默认显示小数位
- 保持 `Score%`、趋势判定和底层数据计算口径不变
- 仅调整展示层精度，不修改服务端原始数值或计算公式
- 补充验证，确保更高精度下表格仍可读、对齐稳定且无误导性四舍五入

## Impact
- Affected specs: 市场风格RPS截面数据展示
- Affected code: `src/components/RpsStylePanel.tsx`、如有必要涉及对应格式化辅助逻辑或展示测试

## ADDED Requirements
### Requirement: 市场风格RPS支持更高精度展示
系统 SHALL 在“市场风格RPS”的截面数据表中，以足够的小数位展示 `RPS` 与 `MA50`，使用户可以区分当前量级较小的数值差异。

#### Scenario: 小量级RPS值可区分
- **WHEN** `RPS` 或 `MA50` 的真实值在当前基准下接近 `0`
- **THEN** 页面展示应保留更多小数位，而不是让多行结果看起来几乎相同
- **THEN** 展示值仍应使用统一规则格式化

## MODIFIED Requirements
### Requirement: 市场风格RPS截面表格格式化
系统 SHALL 在不改变 `RPS`、`MA50` 原始计算结果的前提下，调整其展示精度以提升可读性；`Score%` 的显示精度与现有逻辑保持一致，除非本次实现中发现联动问题需要一并修正。

#### Scenario: 调整展示精度但不改计算
- **WHEN** 页面渲染 `RPS` 与 `MA50` 列
- **THEN** 仅变更前端显示位数
- **THEN** 不改变趋势、排序、Score 或任何服务端计算输出

## REMOVED Requirements
### Requirement: 市场风格RPS截面表格固定以4位小数展示RPS与MA50
**Reason**: 该精度在旧基准下可读，但在 `H30269` 新基准下不足以区分数值差异。
**Migration**: 将 `RPS` 与 `MA50` 的格式化规则升级为更高精度，并校对表格宽度、对齐与视觉可读性。
