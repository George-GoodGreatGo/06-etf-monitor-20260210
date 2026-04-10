# 低波机会：BIAS 基准均线切换（SMA60 / SMA250）Spec

## Why
低波机会目前固定以 SMA250 作为 BIAS 与 BIAS分位的计算基准。增加可切换基准（SMA60 或 SMA250）可让用户按“中期/长期”不同节奏评估偏离程度，并让图表与操作建议联动切换。

## What Changes
- 在“低波机会”Tab 提供一个开关，允许选择 BIAS 计算基准：SMA250（默认）或 SMA60
- 当基准切换时，同步切换以下内容的计算与展示：
  - BIAS 指标曲线（BIAS(60) / BIAS(250)）
  - BIAS分位(3年) 指标曲线（对应基准的分位序列）
  - hover 浮层中的 BIAS 与 BIAS分位数值
  - 操作建议（使用所选基准的 BIAS分位(3年)）
  - 二级导航“操作建议”标签（同上）
- 明确口径：SMA60 / SMA250 均为简单移动平均（SMA），不是 EMA

## Impact
- Affected specs: 低波机会主图/副图指标展示、操作建议生成、二级导航建议标签、hover 信息面板
- Affected code:
  - server/lib/lowVol.ts
  - server/routes/lowVol.ts
  - src/utils/marketApi.ts
  - src/utils/lowVolSignal.ts
  - src/pages/Home.tsx
  - src/components/LowVolOpportunityPanel.tsx
  - src/components/charts/LowVolOpportunityChart.tsx

## ADDED Requirements
### Requirement: BIAS 基准切换
系统 SHALL 在“低波机会”提供 BIAS 基准切换开关：SMA250（默认）与 SMA60。

#### Scenario: 默认基准
- **WHEN** 用户首次进入低波机会
- **THEN** BIAS 与 BIAS分位按 SMA250 口径展示与计算，操作建议基于 SMA250 的 BIAS分位(3年)

#### Scenario: 切换到 SMA60
- **WHEN** 用户将基准切换为 SMA60
- **THEN** BIAS 与 BIAS分位切换为 SMA60 口径，且操作建议与二级导航建议标签同步基于 SMA60 的 BIAS分位(3年)

### Requirement: 服务端提供两套 BIAS 序列
系统 SHALL 在低波指数日频序列接口中同时提供 SMA250 与 SMA60 对应的 BIAS 与 BIAS分位(3年) 序列。

#### Scenario: 接口返回字段
- **WHEN** 客户端请求 `/api/lowvol/index/:code`
- **THEN** 每个 series 点包含以下字段（在原有字段基础上新增，允许为 null）：
  - `ma60`（SMA60）
  - `bias60`（BIAS 基准为 SMA60）
  - `biasPct3y60`（bias60 的 3 年滚动分位）

## MODIFIED Requirements
### Requirement: BIAS 与分位口径
系统 SHALL 使用以下口径计算并输出序列：
- `ma60`：close 的 60 点 SMA（minPeriods=60）
- `ma250`：close 的 250 点 SMA（minPeriods=250，现有逻辑）
- `bias60`：当 ma60 可用且非 0 时，(close - ma60) / ma60，否则为 null
- `bias250`：当 ma250 可用且非 0 时，(close - ma250) / ma250，否则为 null（现有逻辑）
- `biasPct3y60`：bias60 的 3 年滚动分位（window=756，minPeriods=252）
- `biasPct3y`：bias250 的 3 年滚动分位（window=756，minPeriods=252，现有逻辑）

### Requirement: 操作建议使用所选基准的分位
系统 SHALL 在生成操作建议时使用所选基准对应的 BIAS分位(3年)：
- 基准=SMA250：使用 `biasPct3y`
- 基准=SMA60：使用 `biasPct3y60`

## REMOVED Requirements
（无）

