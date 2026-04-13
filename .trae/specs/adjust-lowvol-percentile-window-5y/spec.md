# 低波机会：BIAS 分位与利差分位统一为 5 年窗口 Spec

## Why
当前低波机会中：
- BIAS 分位使用 3 年滚动窗口（约 756 个交易日），在一些长周期行情下波动偏大；
- 利差分位使用 10 年滚动窗口（约 2520 个交易日），对近期结构变化响应偏慢。

为统一口径并在“稳定性/响应度”之间取得更平衡，需将 **BIAS 分位** 与 **利差分位** 的滚动计算周期统一调整为 **5 年**。

## What Changes
- 后端低波序列计算中，将以下滚动分位窗口统一调整为 5 年：
  - BIAS 分位（原 `biasPct3y`、`biasPct3y60`）→ 5 年窗口
  - 利差分位（原 `spreadPctRank10y`）→ 5 年窗口
- 为避免破坏既有前端与历史兼容性：
  - 保留既有字段名，但其 **含义更新为 5 年窗口**
  - 同时新增语义更准确的别名字段（可选）：`biasPct5y`、`biasPct5y60`、`spreadPctRank5y`，与旧字段值一致
- 前端文案/图表标签同步更新为 “5 年分位”，避免误导。

## Impact
- Affected specs: 低波机会图表与信号口径（分位窗口）
- Affected code:
  - `server/lib/lowVol.ts`：滚动分位窗口参数与 meta.notes
  - `src/components/LowVolOpportunityPanel.tsx`、相关图表组件：分位标签文案
  - `src/utils/marketApi.ts`：如启用别名字段，补齐类型（可选）

## ADDED Requirements
### Requirement: 5 年滚动分位窗口
系统 SHALL 将 BIAS 分位与利差分位的滚动计算窗口统一为 5 年。

#### Definition
- 5 年窗口按交易日近似：`windowDays = 1260`
- `minPeriods = 252`（保持不变）

#### Scenario: BIAS 分位
- **WHEN** 计算 BIAS 分位（60 日与 250 日两套）
- **THEN** 滚动分位窗口使用 5 年（windowDays=1260）

#### Scenario: 利差分位
- **WHEN** 计算利差分位（基于 spreadCore/raw）
- **THEN** 滚动分位窗口使用 5 年（windowDays=1260）

## MODIFIED Requirements
### Requirement: API 字段与文案口径
系统 SHALL 在不破坏现有接口的前提下完成窗口变更，并在 `meta.notes` 与前端标签中明确说明：
- “BIAS 分位：5 年滚动分位（window≈1260，minPeriods=252）”
- “利差分位：5 年滚动分位（window≈1260，minPeriods=252，基于 raw/spreadCore）”

## REMOVED Requirements
无

