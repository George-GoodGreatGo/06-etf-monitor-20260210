# 沪深市场大盘看板：Supabase Only 数据管线与读取策略重构 Spec

## Why
当前大盘看板在 Supabase 快照缺失/过期时仍会回源拉取外部数据源，导致数据口径不一致、稳定性受上游影响、且“当日与近几日数据覆盖写入”的需求难以落地。需要把数据获取与计算统一迁移到 GitHub Actions 定时任务中，前端展示仅依赖 Supabase 表数据，实现可控、可追溯、可冷启动的稳定链路。

## What Changes
- 新增/调整 Supabase 表以存储“大盘看板逐日点位数据”（一行=一个交易日），支持 upsert 幂等覆盖写入。
- 新增 GitHub Actions：北京时间工作日 20:00 运行，抓取“当天交易日及前 4 个交易日（合计 5 个交易日）”所需指标并覆盖写入 Supabase，自动跳过非交易日。
- 大盘看板 API 改为 **只读 Supabase**：不再直接调用外部数据源进行回源拉取；当 Supabase 数据不足时返回明确错误状态与提示。
- 增加 Supabase 冷启动机制：提供一次性 backfill 入口，拉取并写入过去 10 年历史数据到 Supabase（用于首次部署/清库后恢复）。
- **BREAKING**：大盘看板实时回源能力移除；数据更新以定时任务为准。

## Impact
- Affected specs:
  - 大盘看板（图表/表格）数据来源与刷新策略
  - market_board_daily/market board 数据落库与读取方式
- Affected code:
  - `server/lib/supabaseRest.ts`（新增/调整读写：按日期范围读取、按日期 upsert）
  - `server/scripts/*`（新增定时任务脚本：5日增量刷新 + 10年冷启动回灌）
  - `server/lib/marketLiquidityV5Service.ts` 或 `server/routes/market.ts`（API 从 Supabase 读取并组装返回结构）
  - `.github/workflows/*`（新增 20:00 定时任务与手动 backfill）
  - `supabase/migrations/*`（新增/调整表结构：逐日点位表）

## ADDED Requirements
### Requirement: 逐日点位表（Supabase）
系统 SHALL 在 Supabase 中存储大盘看板逐日点位数据，满足前端展示所需字段，并支持幂等 upsert。

#### Scenario: upsert 覆盖写入且不重复日期
- **WHEN** 定时任务写入某个交易日 `data_date`
- **THEN** 若该日期已存在则覆盖更新
- **AND** Supabase 中不产生重复日期记录（主键或唯一约束）

#### Data Model (minimum)
每个交易日 SHALL 至少包含（字段名可调整，但语义必须满足）：
- 日期 `data_date`
- 沪深300收盘价 `close`
- 成交额（沪+深，千元）`amount`
- 换手率（沪深均值，%）`tr`
- 北向资金总成交额（亿元）`north_money`
- 三指标分位：`amountPct/trPct/northPct`
- 独家流动性指数：`v5`
- 独家流动性指数分位：`v5Pct`
- 股债相关：`pe/earningsYield/yield10yPct/value/pct`
- 元信息：`fetched_at/source/source_type/notes`（或等价 meta 字段）

### Requirement: 20:00（北京时间）工作日定时刷新最近5个交易日
系统 SHALL 在北京时间工作日 20:00 执行一次刷新任务，覆盖写入最近 5 个交易日的数据。

#### Scenario: 跳过非交易日
- **GIVEN** 定时任务运行当日可能为节假日或无交易数据
- **WHEN** 系统计算“最近 5 个交易日”
- **THEN** 系统基于交易日数据源自动跳过非交易日并选择最近 5 个交易日

#### Scenario: 覆盖写入最近5个交易日
- **WHEN** 定时任务获取到最近 5 个交易日列表
- **THEN** 对每个交易日执行 upsert 写入 Supabase
- **AND** 写入完成后可用数据范围包含这 5 个交易日（含当日，如当日为交易日）

### Requirement: 前端展示仅依赖 Supabase
系统 SHALL 保证大盘看板页面的数据完全来源于 Supabase 表数据，且服务端 API 不再调用任何外部数据源。

#### Scenario: Supabase 数据不足
- **GIVEN** Supabase 中尚未完成冷启动或最近数据缺失
- **WHEN** 前端请求大盘看板数据
- **THEN** API 返回明确失败原因（例如“数据尚未初始化/等待定时任务”）
- **AND** 不触发外部回源请求

### Requirement: Supabase 冷启动（10年历史）
系统 SHALL 提供冷启动 backfill 能力，写入过去 10 年历史数据到 Supabase（按交易日）。

#### Scenario: 一次性回灌
- **WHEN** 运维触发 backfill（手动 workflow 或命令）
- **THEN** 系统拉取过去 10 年交易日范围内的全部所需字段并写入 Supabase
- **AND** upsert 幂等，重复执行不会产生重复日期记录

## MODIFIED Requirements
### Requirement: 大盘看板 API 数据来源
系统 SHALL 将大盘看板 API 的数据来源固定为 Supabase（只读），移除实时回源逻辑。

## REMOVED Requirements
### Requirement: 回源拉取与强制刷新
**Reason**: 为确保稳定性与口径一致性，数据更新统一由定时任务管控。
**Migration**: 使用 20:00 定时任务与手动 backfill 替代；前端不再提供“强刷回源”能力（可保留“刷新页面/重试”但仍仅读 Supabase）。

