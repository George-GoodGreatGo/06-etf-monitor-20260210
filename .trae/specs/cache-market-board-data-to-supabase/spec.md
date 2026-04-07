# 沪深市场大盘看板：数据落库 Supabase + 22:00 定时刷新 Spec

## Why
当前大盘看板数据每次都通过实时 API 拉取与计算，存在耗时、成本与稳定性问题（上游限流/超时/不可用）。需要将大盘看板使用的数据持久化到 Supabase，并在工作日晚间定时刷新，前端优先读取落库数据以提升体验与可靠性。

## What Changes
- 新增 Supabase 表，用于存储“沪深大盘看板”每日一份的完整数据快照（含 meta、series、equityBond 等）。
- 改造服务端读取链路：默认优先读取 Supabase 的最新快照；必要时支持强制刷新回源计算。
- 新增定时刷新机制：工作日北京时间 22:00 自动拉取最新数据并写入 Supabase。
- 加入幂等与去重：确保同一 `dataDate` 不会产生重复记录（使用唯一约束 + upsert）。
- 为“快照来源/回源来源/失败原因”提供可追溯 meta 字段，便于 UI 状态栏展示与排障。

## Impact
- Affected specs: 沪深市场大盘看板（图表/表格视图）、市场大盘解读（读取同一份数据快照）
- Affected code:
  - 后端：`server/lib/marketLiquidityV5Service.ts`（读写快照策略）、`server/lib/supabaseRest.ts`（新增读写封装）、`server/routes/market.ts`（API 行为可能扩展）
  - 调度：GitHub Actions 工作流（新增或复用 22:00 任务）
- 新增数据表：`market_board_daily`（或等价命名）

## ADDED Requirements
### Requirement: 存储大盘看板每日快照
系统 SHALL 将大盘看板数据按“交易日 dataDate”存入 Supabase，形成每日快照。

#### Scenario: 写入成功
- **WHEN** 系统完成一次大盘数据计算/拉取
- **THEN** 以 `dataDate` 为主键（或唯一键）写入/更新一条记录
- **AND** 记录包含 `meta`（source/notes/fetchedAt/dataDate）与完整数据负载（series/equityBond 等）

#### Scenario: 幂等去重
- **GIVEN** Supabase 已存在同一 `dataDate` 的记录
- **WHEN** 再次写入该 `dataDate`
- **THEN** 系统执行 upsert（更新）或直接跳过写入
- **AND** 数据表中不产生重复 `dataDate` 记录

### Requirement: 默认读取快照
系统 SHALL 在大盘看板 API 默认优先读取 Supabase 最新快照。

#### Scenario: 快照存在
- **GIVEN** Supabase 中存在最新快照（按 `dataDate` 排序）
- **WHEN** 前端请求大盘看板数据
- **THEN** 直接返回该快照内容
- **AND** `meta.sourceType` 标注为 `supabase-snapshot`（或等价字段）

#### Scenario: 快照缺失或不可用
- **GIVEN** Supabase 无数据或读取失败
- **WHEN** 前端请求大盘看板数据
- **THEN** 系统回源计算/拉取（沿用现有数据源策略）
- **AND** 成功后将结果写回 Supabase 作为新快照

### Requirement: 22:00 定时刷新
系统 SHALL 在工作日北京时间 22:00 自动触发一次“拉取/计算最新大盘数据并写入 Supabase”的任务。

#### Scenario: 正常交易日刷新
- **WHEN** 到达工作日 22:00（北京时间）
- **THEN** 系统运行刷新任务并写入/更新当日 `dataDate` 快照

#### Scenario: 非交易日/无新数据
- **WHEN** 到达工作日 22:00 但上游无新交易日数据（节假日/临时停市/延迟）
- **THEN** 系统不产生重复日期记录
- **AND** 记录任务结果到日志/notes（例如“无新交易日，保持最新快照”）

## MODIFIED Requirements
### Requirement: 大盘看板数据来源声明
系统 SHALL 在 `meta` 中明确区分数据来源类型：
- `primary-realtime`：实时主源
- `fallback-realtime`：实时替代源
- `supabase-snapshot`：Supabase 快照

并在 UI 状态栏可展示上述来源类型与 `dataDate`，以避免用户误读。

