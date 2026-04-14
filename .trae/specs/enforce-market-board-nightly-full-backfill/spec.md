# 沪深市场大盘看板：夜间全量回灌（10年）与限流防护 Spec

## Why
为避免历史数据口径/上游质量变化导致“旧数据不准确”，希望在每日夜间固定窗口内对过去 10 年的大盘看板数据进行全量重算与覆写，保证 Supabase 表始终可被视为“唯一可信源”。同时，全量回灌会显著增加外部数据源请求量，必须加入节流、退避与拆分策略以降低被限流/封锁的风险。

## What Changes
- GitHub Actions（北京时间 20:00–22:00 窗口）将大盘看板刷新从“增量 5 个交易日”改为“**每次全量回灌近 10 年**”，并在写入前废弃旧数据（同日期覆盖、不重复日期）。
- 全量回灌增加限流防护：分段拉取、并发限制、请求间隔、指数退避+抖动、失败重试与熔断；确保任务可在 2 小时窗口内完成或给出明确失败原因。
- Supabase 写入策略增强：按日期分批 upsert；必要时先删除近 10 年范围内旧记录再写入，以保证“完全覆写”；并清理 10 年窗口外的历史行。
- 前端与 API 继续保持 **Supabase Only**（不回源外部 API）；数据更新时间以 Supabase 表的最新 `fetched_at/data_date` 为准。
- **BREAKING**：全量回灌将导致历史值每日可能重算回溯（尤其当上游修订数据时），属于预期行为。

## Impact
- Affected specs: `revamp-market-board-supabase-only`（刷新策略与回灌粒度变更）
- Affected code:
  - `.github/workflows/refresh-market-board.yml`（schedule 与执行模式：backfill）
  - `server/scripts/refreshMarketBoardPoints.ts`（默认 backfill、分段拉取、限流防护、覆写/清理策略）
  - `server/lib/marketLiquidityV5Service.ts`（如需支持分段拉取的聚合接口）
  - `server/lib/supabaseRest.ts`（如需增加 delete-by-range 等能力）

## ADDED Requirements
### Requirement: 夜间全量回灌（10年）
系统 SHALL 在每日夜间运行大盘看板回灌任务，并自动覆写过去 10 年交易日数据到 Supabase。

#### Scenario: 每次任务都覆写近10年
- **WHEN** GitHub Actions 在夜间窗口运行
- **THEN** 系统以“今日北京时间”为基准选择近 10 年日期范围
- **AND** 对该范围内所有交易日生成/重算大盘看板逐日点位并写入 Supabase
- **AND** 写入结果对相同 `data_date` 幂等覆盖，不产生重复日期

### Requirement: 废弃旧数据（确保完全覆写）
系统 SHALL 在一次回灌中确保 Supabase 中近 10 年范围的记录来自本次任务计算结果。

#### Scenario: 覆写策略
- **WHEN** 任务开始写入 Supabase
- **THEN** 系统采用以下之一（实现任选其一，但需满足“完全覆写”）：
  - **Option A**：先删除近 10 年范围内旧记录，再分批写入本次结果
  - **Option B**：全量 upsert 覆盖写入本次结果，并在结束时删除该范围内“本次未覆盖”的日期（例如运行标记/集合差）

### Requirement: 限流/封锁风险控制
系统 SHALL 在外部数据源拉取过程中使用节流与退避策略，以降低被限流/封锁风险。

#### Scenario: 请求节流与并发限制
- **WHEN** 系统对外部数据源发起请求
- **THEN** 同一数据源的并发请求数 SHALL 不超过 1
- **AND** 请求之间 SHALL 引入固定或随机间隔（jitter）

#### Scenario: 限流与失败重试
- **GIVEN** 外部接口返回 429/5xx 或网络超时
- **WHEN** 系统重试请求
- **THEN** 采用指数退避并叠加随机抖动
- **AND** 超过最大重试次数后记录失败原因并中止或降级（不得写入推测值）

### Requirement: 任务窗口与可观测性
系统 SHALL 将任务安排在北京时间 20:00–22:00 的执行窗口内，并输出可诊断日志。

#### Scenario: 运行窗口与日志
- **WHEN** 任务运行
- **THEN** 在日志中输出：目标日期范围、分段批次数、写入行数、失败原因（如有）
- **AND** 任务需配置 concurrency，避免同一仓库同时跑多个回灌造成封锁风险

## MODIFIED Requirements
### Requirement: 定时任务刷新粒度
系统 SHALL 将大盘看板定时任务从“最近 5 个交易日增量写入”调整为“近 10 年全量覆写写入”。

## REMOVED Requirements
N/A

