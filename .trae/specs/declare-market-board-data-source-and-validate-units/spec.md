# 沪深大盘看板：数据来源声明与单位复核 Spec

## Why
当前大盘看板已支持多数据源降级（主源/替代源/快照），但业务侧需要在“数据状态栏”直观看到本次数据来源；同时需要复核表格视图中成交额与北向资金的单位与数值口径一致，避免误读。

## What Changes
- 在沪深市场大盘看板的“数据状态栏”展示本次数据来源与数据日期（含主源/替代源/快照）。
- 对表格视图的单位与数值进行复核并固化：成交额（沪+深）与北向资金净流入的单位、换算与展示文案一致。
- 将单位口径写入服务端 `meta.notes`，前端可在状态栏/提示中展示或折叠查看。

## Impact
- Affected specs: 大盘看板数据可解释性（来源可见、单位明确）
- Affected code:
  - 前端：大盘看板表格/状态栏组件（展示 `meta`）
  - 后端：`server/lib/marketLiquidityV5Service.ts`（补齐 `meta` 字段与单位说明）

## ADDED Requirements
### Requirement: 数据状态栏展示数据来源
系统 SHALL 在大盘看板（表格视图）数据状态栏展示本次数据来源与数据日期。

#### Scenario: 主源成功
- **WHEN** 大盘数据获取成功且来源为主源
- **THEN** 状态栏显示“主数据源（financedata）”与 `dataDate`

#### Scenario: 替代源成功
- **WHEN** 大盘数据获取成功且来源为替代源
- **THEN** 状态栏显示“替代数据源（Eastmoney HTTP / CSIndex / Eastmoney Datacenter …）”与 `dataDate`

#### Scenario: 快照回退
- **WHEN** 本次使用最近一次成功快照
- **THEN** 状态栏显示“快照数据源（最近一次成功快照）”与 `dataDate`
- **AND** 显示“非实时”标识

### Requirement: 单位与口径复核（成交额与北向资金）
系统 SHALL 复核并固化表格视图中数值与单位口径一致，并在 `meta.notes` 中明确说明。

#### Scenario: 成交额（沪+深）
- **WHEN** 表格展示“成交额（沪+深）”
- **THEN** 单位与后端换算一致（例如“千元”）
- **AND** `meta.notes` 明确写明来源字段与换算关系

#### Scenario: 北向资金净流入
- **WHEN** 表格展示“北向资金净流入”
- **THEN** 单位与数据源字段口径一致（不得推测换算）
- **AND** `meta.notes` 明确写明来自哪个字段（例如 `NF_DEAL_AMT`）及其单位口径（以数据源标注为准）

## MODIFIED Requirements
### Requirement: `meta` 字段可消费
系统 SHALL 在获取大盘数据时提供前端可直接消费的 `meta` 信息，至少包括：
- `meta.source`：字符串，描述数据源组合
- `meta.dataDate`：字符串，最新数据日期
- `meta.notes`：字符串数组，包含单位口径与降级说明

