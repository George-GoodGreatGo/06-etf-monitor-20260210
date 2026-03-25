# ETF Detail Top Indicators Spec

## Why
用户希望在 ETF 详情页顶部看到更多关键指标，以便快速了解当前 ETF 的市场热度与异动情况，同时需要清晰说明数据来源，避免用户对数据准确性产生疑惑。

## What Changes
1. 在详情页顶部的指标卡片区，除了已有的“最新完整交易日”外，新增以下数据点：
   - 当前交易日成交额（单位：亿元）
   - 较昨日变化%
   - 较7日均%
   - 90日成交额Z值（调整了已有显示位置，使其与新增指标对齐）
2. 在右侧“数据约束”卡片中，补充“数据来源”说明，介绍所有数据点（日线、周线、成交额）来源于新浪财经公开接口，指标（EMA/SMA/MACD/RSI等）由本地运算得出，文字控制在 150 字以内。

## Impact
- Affected specs: ETF 详情页顶部 UI 结构。
- Affected code:
  - `src/pages/EtfDetail.tsx` (前端 UI 渲染逻辑)
  - `server/routes/etf.ts` (后端返回 `detail` 接口的字段补充)
  - `src/utils/etfApi.ts` (前端接口类型定义 `EtfDetail`)

## ADDED Requirements
### Requirement: 增加成交额及异动指标展示
系统 SHALL 在详情页顶部展示当前交易日成交额、较昨日变化%、较7日均% 和 90日成交额Z值。

#### Scenario: 成功展示数据
- **GIVEN** 后端成功返回 ETF 详情数据（包含 volume, turnover, turnoverChangePct1d 等）
- **WHEN** 用户访问 ETF 详情页
- **THEN** 顶部网格区域正确展示上述 5 个指标，且涨跌幅根据正负值显示红绿色。

### Requirement: 说明数据来源
系统 SHALL 在“数据约束”卡片中补充详细的数据来源说明。
