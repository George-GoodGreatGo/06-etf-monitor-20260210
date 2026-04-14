# 沪深市场大盘看板：Supabase 数据可见性与字段完整性修复 Spec

## Why
目前大盘看板出现三类问题：前端表格/图表时间截止落后（如 2020-05-22），而 Supabase 表中已有更晚数据；同时 Supabase 中股债相关字段（PE/10Y/股债分位）长期为 null；前端副图呈现空白或异常。需要从“run_id 批次切换”链路上彻底修复：确保只展示最新完整批次、并保证关键字段在写入前已可计算且可用。

## What Changes
- 引入“回灌批次完成度”机制：写入新 run_id 后先做完整性校验（覆盖日期、关键字段非空率），仅当通过才切换 `market_board_meta.current_run_id`。
- 修复“前端读到旧 run / 数据截止落后”：API 增加对 `market_board_meta` 的健壮读取与回退策略（必要时回退到 previous_run_id 或最新可用 run），避免卡在 bootstrap/不完整批次。
- 修复股债字段长期为 null：将 10Y 国债收益率数据获取改为更稳健的数据源/实现（优先使用已有 safe 逻辑或缓存），并确保在写入 Supabase 前 `equityBond` 序列已生成；若无法生成，回灌视为失败（不切换 run）。
- 增强可观测性：在回灌日志输出每段与全局的关键统计（最大日期、写入行数、PE/10Y 覆盖率、缺失原因），便于定位。
- 修复“图表空白/异常”：API 对返回序列做有效性校验（空数组/全 null/日期未递增等均视为不可用），返回明确错误以触发前端错误态，而不是将空序列交给图表渲染。
- （可选）增强 `market_board_meta`：记录每次 run 的完成状态与关键统计（completed_at/max_date/coverage），供 API 回退选择与排障。

## Impact
- Affected specs:
  - `enforce-market-board-nightly-full-backfill`（“失败不切换”进一步增强为“未通过完整性校验不切换”）
  - `revamp-market-board-supabase-only`（只读 Supabase 的可用性与数据质量保障）
- Affected code:
  - `server/scripts/refreshMarketBoardPoints.ts`（完整性校验、批次切换条件、日志）
  - `server/lib/marketBoardSupabaseService.ts`（读取策略回退：避免只读到旧 run）
  - `server/lib/marketLiquidityV5Service.ts` / `server/lib/chinamoneyGovBond.ts`（10Y 数据的稳健获取）
  - `server/lib/supabaseRest.ts`（读取/列举 run 的辅助接口，必要时）
  - （可选）Supabase：在 `market_board_meta` 增加状态字段（completed_at/range/max_date/coverage）

## ADDED Requirements
### Requirement: 批次完成度校验（不通过不切换）
系统 SHALL 在 backfill 写入完成后，对新 run_id 做完整性校验；未通过则不得切换 `current_run_id`。

#### Scenario: 覆盖日期必须跟上 endDate
- **GIVEN** backfill 目标范围为 startDate..endDate（近10年）
- **WHEN** 回灌写入完成
- **THEN** 新 run 的最大 `data_date` SHALL ≥ endDate-3个交易日（允许少量上游延迟）

#### Scenario: 关键字段非空率校验
- **WHEN** 回灌写入完成
- **THEN** 在近 2 年窗口内（≈504 交易日）：
  - `amount/tr/north_money` 非空率 SHALL ≥ 95%
  - `pe` 非空率 SHALL ≥ 95%
  - `yield10y_pct` 非空率 SHALL ≥ 95%
- **AND** 未达标时回灌失败（退出码非0），保持旧 run 可见

### Requirement: API 读取策略回退
系统 SHALL 在读取 Supabase 时避免卡在 bootstrap/不完整批次，并提供可回退策略。

#### Scenario: current_run_id 不可用
- **GIVEN** current_run_id 对应的数据为空或最大日期明显落后
- **WHEN** API 读取大盘看板数据
- **THEN** API SHALL 回退到 previous_run_id（若可用）或最近一次“完成度通过”的 run
- **AND** 在 `meta.notes` 中说明回退原因

### Requirement: 股债字段必须可计算
系统 SHALL 确保 `equityBond` 序列可生成并写入 Supabase（PE/10Y/股债分位等字段不应长期为 null）。

#### Scenario: 10Y 数据不可用时
- **GIVEN** 外部 10Y 数据源不可用或返回空
- **WHEN** backfill 需要生成 equityBond 序列
- **THEN** 系统应使用备用实现（safe/缓存）尝试恢复
- **AND** 若仍不可用，则回灌失败且不切换 run（避免写入“缺关键字段”的新批次）

### Requirement: API 返回数据有效性校验
系统 SHALL 在返回大盘看板序列数据前进行有效性校验，避免前端渲染空白或异常图表。

#### Scenario: 返回空序列或无有效点
- **GIVEN** 指定 run_id 范围查询返回 0 行或关键序列（如 close/v5）全部为 null
- **WHEN** API 读取大盘看板数据
- **THEN** API SHALL 返回明确错误（包含 code/msg），且不得返回“看似成功但数据为空”的 payload

#### Scenario: 日期序列异常
- **GIVEN** 返回序列存在日期重复或未严格递增
- **WHEN** API 读取大盘看板数据
- **THEN** API SHALL 返回错误并在日志中标注异常样本数量（便于定位写入/去重问题）

## MODIFIED Requirements
N/A

## REMOVED Requirements
N/A
