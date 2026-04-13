# 沪深市场大盘看板：滚动计算周期统一为5年 Spec

## Why
当前大盘看板中部分分位/合成指标采用 360/720 交易日窗口，稳定性与长期可比性不足。将滚动计算周期统一调整为 5 年，有助于降低短周期噪音并提升信号的长期参考价值。

## What Changes
- 将“独家流动性指数（3指标）”中 3 个依赖分位序列的滚动窗口调整为 5 年（≈1260 交易日），并相应调整最小有效样本数。
- 将“股债性价比（分位）”滚动分位窗口调整为 5 年（≈1260 交易日），并相应调整最小有效样本数。
- 同步更新大盘看板页面指标说明与表格视图口径文案（360/720 → 5年）。
- **BREAKING**：接口返回字段结构不变，但分位/指数数值口径变化，历史对比与缓存需视为新版本。

## Impact
- Affected specs:
  - 独家流动性指数（3指标）计算口径
  - 股债性价比（分位）计算口径
  - 大盘看板指标说明文案
  - 大盘看板表格视图字段口径
- Affected code:
  - `server/lib/liquidityV5.ts`（分位窗口期与最小样本）
  - `server/lib/equityBondValue.ts`（分位窗口期与最小样本）
  - `server/routes/market.ts`（接口 notes/meta 口径更新；必要时更新缓存版本键）
  - `src/components/charts/MarketLiquidityChart.tsx`（股债性价比（分位）序列口径提示/标题）
  - `src/components/MarketLiquidityPanel.tsx`（指标说明文案）
  - `src/components/MarketLiquidityTableView.tsx` 或同类表格组件（如存在，更新列说明/表头提示）

## MODIFIED Requirements
### Requirement: 独家流动性指数（3指标）分位窗口期
系统 SHALL 将成交额分位（amountPct）、换手率分位（trPct）、北向资金分位（northPct）的滚动分位窗口调整为 5 年。

#### Scenario: 分位窗口为 5 年
- **GIVEN** 有连续的交易日数据序列
- **WHEN** 系统计算 amountPct/trPct/northPct 任一分位序列
- **THEN** 分位窗口使用 5 年（windowDays≈1260）
- **AND** 若近 5 年窗口内有效数据点 < minPeriods，则当日分位为 null/NaN

#### Parameters
- windowDays = 1260（按交易日近似）
- minPeriods = 630

### Requirement: 独家流动性指数（v5）口径保持不变，仅输入窗口变化
系统 SHALL 继续使用现有合成公式与阈值判断；仅调整其依赖的 3 个分位序列窗口期为 5 年。

#### Scenario: v5 的计算不改变结构
- **GIVEN** v5 由 amountPct/trPct/northPct 合成（以现有实现为准）
- **WHEN** 系统计算 v5
- **THEN** v5 合成逻辑不变
- **AND** v5 使用基于 5 年窗口的分位序列作为输入

### Requirement: 股债性价比（分位）窗口期
系统 SHALL 将股债性价比分位 pct 的滚动窗口调整为 5 年。

#### Scenario: 股债性价比分位为 5 年滚动分位
- **GIVEN** 股债性价比 value 的定义保持现有实现口径不变
- **WHEN** 系统计算股债性价比（分位）pct
- **THEN** 分位窗口使用 5 年（windowDays≈1260）
- **AND** 若近 5 年窗口内有效数据点 < minPeriods，则当日 pct 为 null/NaN

#### Parameters
- windowDays = 1260（按交易日近似）
- minPeriods = 630

### Requirement: 文案与口径一致性
系统 SHALL 在大盘看板的指标说明与表格视图中，明确展示最新参数口径为“5年滚动分位（window≈1260，min≈630）”，且不残留 “360日/720日” 描述。

## ADDED Requirements
N/A

## REMOVED Requirements
N/A

