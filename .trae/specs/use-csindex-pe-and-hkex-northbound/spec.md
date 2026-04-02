# 沪深大盘：接入中证PE与HKEX北向资金 Spec

## Why
当前在 Serverless 环境下需要一套免费、可靠且不依赖 Python 的数据源，用于补齐沪深300指数 PE 与北向资金净流入，从而恢复股债利差/分位与北向分位等指标链路。

## What Changes
- 新增“中证指数（CSIndex）沪深300估值（PE）”数据拉取通道，并接入到大盘指标计算中。
- 新增“HKEX Stock Connect 北向资金净流入”数据拉取通道，并接入到大盘指标计算中。
- 在数据源降级策略中优先使用上述两条免费通道；失败时回退到已有快照，不生成推测值。
- 在 `meta.source / meta.notes` 中清晰标注：本次计算使用的数据源组合与缺失字段说明。

## Impact
- Affected specs: 大盘看板指标数据完整性（北向资金、沪深300 PE、股债利差/分位、北向分位）
- Affected code: `server/lib/marketLiquidityV5Service.ts`、（新增）`server/lib/csindex.ts`、（新增）`server/lib/hkex.ts`、前端展示（无需改动口径，仅消费现有字段）

## ADDED Requirements
### Requirement: CSIndex 沪深300 PE 数据源
系统 SHALL 通过中证指数官网公开接口获取沪深300估值时间序列，并将其映射为沪深300 PE 数据输入。

#### Scenario: Success case
- **WHEN** 服务端请求获取指定日期范围的沪深300 PE
- **THEN** 返回按交易日排序的 `{ trade_date, pe }` 序列（`trade_date` 为 `YYYYMMDD` 或 `YYYY-MM-DD`，需与现有逻辑对齐）
- **AND** 标注 `meta.source` 包含 `csindex`

#### Scenario: Failure case
- **WHEN** CSIndex 接口不可用或返回异常
- **THEN** 不生成推测值；记录失败原因到 `meta.notes`
- **AND** 系统按既有策略尝试其它数据源或回退快照

### Requirement: HKEX 北向资金净流入数据源
系统 SHALL 通过 HKEX 官方公开页面/接口获取北向资金净流入（按日），并将其映射为北向资金序列输入。

#### Scenario: Success case
- **WHEN** 服务端请求获取指定日期范围的北向资金净流入
- **THEN** 返回按交易日排序的 `{ trade_date, north_money }` 序列
- **AND** `north_money` 单位在 `meta.notes` 中明确（例如：港币/人民币、元/百万等；以 HKEX 输出为准，不做推测换算）
- **AND** 标注 `meta.source` 包含 `hkex`

#### Scenario: Failure case
- **WHEN** HKEX 页面结构变化、接口变更或被风控拦截
- **THEN** 不生成推测值；记录失败原因到 `meta.notes`
- **AND** 系统按既有策略尝试其它数据源或回退快照

## MODIFIED Requirements
### Requirement: 大盘流动性V5数据源组合策略
系统 SHALL 在 Serverless 环境下默认优先使用无需 Python 的数据源组合：
- 沪深300/上证/深证日线与成交额/换手率：继续使用 Eastmoney HTTP（已存在）
- 沪深300 PE：优先使用 CSIndex
- 北向资金净流入：优先使用 HKEX
- 10Y 国债收益率：继续使用现有 `chinamoneyGovBond`（已存在）

并且：
- 若某一数据源缺失对应字段，则该字段保持 `null`，不得用常数或插值产生推测值。
- `meta.notes` 必须说明：本次哪些字段来自哪些源、哪些字段缺失以及原因。

## REMOVED Requirements
### Requirement: 使用 Tushare 补齐北向与PE
**Reason**: Tushare 接口存在权限（积分）门槛，不符合“免费稳健”要求。
**Migration**: 改为 CSIndex（PE）+ HKEX（北向）组合；若不可用则回退快照，不输出推测值。

