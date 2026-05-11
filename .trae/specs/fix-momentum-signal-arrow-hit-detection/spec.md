# 动量分析买卖箭头点击命中修复 Spec

## Why
当前"动量分析"主图上的交易信号箭头（红色买入箭头、绿色卖出箭头）在用户点击时命中率很低，难以触发弹窗展示信号详情。根因是点击命中检测函数 `resolveSignalMarkerFromClick` 使用 `series.priceToCoordinate(candidate.price)` 计算 marker 像素坐标，但未考虑 lightweight-charts 内部对 `atPriceBottom`/`atPriceTop` 位置所做的视觉偏移，导致用户点击箭头实际位置时，检测到的 Y 坐标在价格线位置，产生系统性偏差。

## What Changes
- 修正 `resolveSignalMarkerFromClick` 中的 Y 坐标计算，根据 marker 的 `position` 属性（`atPriceTop`/`atPriceBottom`）补偿 lightweight-charts 的渲染偏移
- 保持 `SIGNAL_MARKER_HIT_RADIUS_PX` 命中半径不变（18px 在坐标正确后已足够），或微调增大箭头 `size` 以提升视觉可点击感知
- 不改变买卖信号判定逻辑、不改变 marker 的 position/shape/color 配置

## Impact
- Affected specs: `add-momentum-analysis-buy-sell-markers`
- Affected code: `src/components/charts/RpsCustomQueryCharts.tsx` — `resolveSignalMarkerFromClick` 函数

## ADDED Requirements
无新增业务需求，仅修复现有功能的交互缺陷。

## MODIFIED Requirements
### Requirement: 买卖信号箭头点击触发信号详情弹窗
系统 SHALL 在用户点击买入/卖出箭头的视觉渲染位置时，能够命中并弹出信号详情 tooltip/弹窗。

#### Scenario: 点击买入箭头命中
- **WHEN** 用户在动量分析主图上点击一个红色向上箭头（买入信号）的可见渲染区域
- **THEN** 系统识别该点击，并弹出对应的买入信号详情（包含日期、价格、策略、原因等）
- **AND** 命中判定使用箭头在实际渲染位置（考虑 `atPriceBottom` 偏移后的坐标），而非价格线位置

#### Scenario: 点击卖出箭头命中
- **WHEN** 用户在动量分析主图上点击一个绿色向下箭头（卖出信号）的可见渲染区域
- **THEN** 系统识别该点击，并弹出对应的卖出信号详情
- **AND** 命中判定使用箭头在实际渲染位置（考虑 `atPriceTop` 偏移后的坐标），而非价格线位置

## REMOVED Requirements
无。
