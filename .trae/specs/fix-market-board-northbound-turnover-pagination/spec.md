# 沪深市场大盘看板：修复“北向资金总成交额”整段恒定的问题 Spec

## Why
大盘看板表格/图表中的“北向资金总成交额(亿元)”出现长区间恒定为同一个数值，导致北向分位与流动性相关指标失真，失去参考意义。

## What Changes
- 修复服务端北向资金总成交额序列的拉取逻辑，确保在请求较长日期区间时能够完整获取全部分页数据，不再只拿到单页数据导致后续日期被前值填充。
- 增强数据有效性校验：若北向资金序列的最新日期明显落后于请求区间末端，则视为数据不完整，避免对大段缺失进行 ffill 产生“常数段”。
- 同步更新接口 `meta.notes`：明确北向资金数据源、分页策略与缺失处理策略。
- **BREAKING**：修复后北向资金序列历史值将发生变化，导致 v5/northPct 等结果回溯变化；缓存与快照需要按新版本隔离。

## Impact
- Affected specs: 大盘看板数据可信度、流动性指标与表格视图
- Affected code:
  - `server/lib/hkex.ts`（北向资金总成交额拉取：分页/校验）
  - `server/lib/marketLiquidityV5Service.ts`（数据完整性校验、notes、缓存版本）
  - `server/lib/liquidityV5.ts`（如需调整北向缺失对 v5 的处理策略）
  - `src/components/MarketLiquidityTable.tsx`（显示不变，但将不再出现“整段常数”）

## ADDED Requirements
### Requirement: 北向资金总成交额序列分页完整
系统 SHALL 在拉取北向资金总成交额（DEAL_AMT）时支持分页，确保覆盖请求区间内可用的全部交易日数据。

#### Scenario: 长区间分页拉取
- **GIVEN** 用户请求的日期区间跨度超过单页容量（例如 >600 条）
- **WHEN** 服务端调用北向资金数据源
- **THEN** 服务端应自动拉取全部分页并合并去重
- **AND** 返回序列按日期升序排列

### Requirement: 北向资金数据完整性校验
系统 SHALL 在构建大盘看板序列时校验北向资金数据是否跟上请求的区间末端。

#### Scenario: 最新日期明显落后
- **GIVEN** 请求区间末端为 endDate
- **WHEN** 北向资金序列的最新 trade_date 早于 endDate 超过阈值（例如 10 个交易日）
- **THEN** 系统标记该字段为不完整
- **AND** 不得将单一旧值通过 fill-forward 传播到后续大量日期
- **AND** 在 `meta.notes` 中说明不完整原因

### Requirement: 缓存与快照按版本隔离
系统 SHALL 在本次修复上线后通过版本号隔离缓存/快照，避免继续复用旧口径导致的错误序列。

## MODIFIED Requirements
N/A

## REMOVED Requirements
N/A

