# 股债性价比数据源切换为 Baostock Spec

## Why
当前股债性价比（分位）依赖第三方数据源组合，历史跨度与稳定性有限，导致序列长度不够、并可能出现缺口影响阅读体验。需要尝试使用 Baostock 获取更长周期的数据，并在对齐交易日后尽量减少空缺。

## What Changes
- 将股债性价比（分位）的关键输入数据源切换为 Baostock（优先使用 Baostock；失败时可回退现有数据源以保证可用性）。
  - 沪深300 PE（日频）：使用 Baostock 输出字段（如 `peTTM` 或同等口径 PE 字段）
  - 中国10Y国债收益率（日频）：使用 Baostock 的利率/收益率相关接口（若 Baostock 不提供日频10Y，则回退到现有来源）
- 数据对齐策略：
  - 以沪深300交易日序列为主基准（与主图日期一致）
  - 对 PE 与 10Y收益率序列按日对齐，并对缺失点做前值填充（ffill）以减少空缺
  - 对异常值做防御处理（PE<=0 视为无效；收益率单位统一为小数参与计算）
- 继续输出：
  - `equity_bond_value = (1/PE) - 10Y_yield`
  - 对 value 计算滚动分位（窗口按当前实现配置，例如 180 日；min 20 不变）
- 更新接口 `meta.source` / `meta.notes`，明确数据来源与对齐/填充口径。

## Impact
- Affected specs: 首页「流动性指数」Tab → 股债性价比（分位）副图
- Affected code:
  - `server/routes/market.ts`（数据源切换与 meta 描述更新）
  - `server/lib/equityBondValue.ts`（保持计算逻辑，必要时增强缺失处理）
  - `server/lib/baostock.ts`（新增：Node 侧封装调用 Python Baostock 服务）
  - `server/python/baostock_service.py`（新增：通过 Baostock 拉取 PE 与 10Y收益率并输出 JSON）
  - `src/utils/marketApi.ts`（若返回结构有变化需同步类型）

## MODIFIED Requirements
### Requirement: 股债性价比输入数据更长且更连续
系统 SHALL 优先使用 Baostock 获取沪深300 PE 与 10Y 国债收益率数据，以获得更长周期并减少缺口。

#### Scenario: 数据对齐后缺口最小化
- **GIVEN** 沪深300交易日序列为主基准
- **WHEN** 某日 PE 或 10Y收益率缺失
- **THEN** 系统对该序列进行前值填充（ffill）以尽量形成连续序列
- **AND** 若连续缺失导致 ffill 无法生效（例如序列起始缺失），该日 value/pct 为 null

### Requirement: 数据源回退策略
系统 SHALL 在 Baostock 不可用（网络/登录失败/无数据）时回退到现有数据源，保证页面可用。

#### Scenario: Baostock 不可用
- **WHEN** Baostock 拉取失败
- **THEN** 系统回退现有数据源继续计算并返回
- **AND** `meta.source` 与 `meta.notes` 中明确标注当前实际使用的数据源

