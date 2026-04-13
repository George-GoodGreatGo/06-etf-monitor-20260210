# 低波机会：夜间增量拉取 + 回补合并写回（N=10 年冷启动）Spec

## Why
当前夜间刷新脚本对每个指数会拉取长历史区间（近 15 年）并写入快照，这会造成单次请求更重、更慢，增加触发上游 WAF/封禁的概率。为了在“用户访问不回源”的前提下进一步降低封禁风险，需要将夜间刷新改为“增量优先 + 小窗口回补”，并在写入 Supabase 前将增量与历史快照进行合并，避免丢失历史数据。

## What Changes
- 夜间刷新脚本改造为三段式策略（按指数逐个处理）：
  - **Step A：读取 Supabase 最新快照**（按 code）
  - **Step B：有快照** → 增量拉取（从 `max(lastDataDate - 5 天, 10年前01-01)` 到 `endDate`）并与历史 `series` 合并写回
  - **Step C：无快照** → 冷启动拉取 `N=10 年`（从 “当年-10 年”的 01-01 到 `endDate`），形成首份全量 `series` 写回
- 继续保留：串行队列、抖动等待、失败最多重试 1 次；WAF 直接熔断并终止本轮。
- 读取快照的鉴权与部署一致：夜间脚本在 GitHub Actions 环境下使用 `SUPABASE_SERVICE_ROLE_KEY` 也能读取最新快照（不强依赖 `SUPABASE_ANON_KEY`）。
- `endDate` 以脚本运行时的当前日期计算（`YYYYMMDD`），实际写入 Supabase 的 `dataDate` 以序列最新交易日为准（不与自然日强绑定）。

## Impact
- Affected specs: 低波机会夜间刷新机制（降低触发封禁概率）
- Affected code:
  - `server/scripts/refreshLowVolSnapshots.ts`：增量策略、合并逻辑
  - `server/lib/supabaseRest.ts`：读取最新快照（需包含 payload，用于合并；支持 service role 读取）
  - `server/lib/lowVol.ts`：无需改动（仍负责计算与 WAF 处理）

## ADDED Requirements
### Requirement: 增量优先刷新
系统 SHALL 在存在历史快照时，仅拉取增量区间并与历史合并写回。

#### Scenario: 有快照
- **GIVEN** Supabase 存在该指数最新快照（含 `payload.series`）
- **WHEN** 夜间刷新执行该指数
- **THEN** 系统拉取区间为 `[max(lastDataDate - 5 天, 10年前01-01), endDate]`
- **AND** `lastDataDate` 来自快照 `data_date`（`YYYY-MM-DD`），回源请求需转换为 `YYYYMMDD`
- **AND** 系统将增量 `series` 与历史 `series` 去重合并（按 date 唯一）
- **AND** 系统写回 Supabase 的 `code + dataDate` 快照记录，其中 `dataDate` 取“合并后序列最后一个点的交易日”（不强行等于自然日）

### Requirement: 冷启动 N=10 年
系统 SHALL 在无快照时，拉取 N=10 年数据作为首份快照写回。

#### Scenario: 无快照
- **GIVEN** Supabase 中不存在该指数快照
- **WHEN** 夜间刷新执行该指数
- **THEN** 系统拉取区间为 `[10年前的 01-01, endDate]`
- **AND** 写回 Supabase 的 `code + dataDate` 快照记录，其中 `dataDate` 取序列最后一个点的交易日

#### Scenario: 快照存在但不可用
- **GIVEN** Supabase 返回了 row，但 `payload.series` 缺失/非数组
- **WHEN** 夜间刷新执行该指数
- **THEN** 系统按“无快照”处理，执行冷启动拉取（避免写回空历史导致丢数据）

### Requirement: 合并写回不丢历史
系统 SHALL 确保增量刷新不会导致历史数据丢失。

#### Scenario: 合并规则
- **WHEN** 合并历史 `series` 与增量 `series`
- **THEN** 按 `date` 去重（同 date 以增量为准覆盖）
- **AND** 合并结果按 date 升序排序

## MODIFIED Requirements
### Requirement: 降低封禁风险
系统 SHALL 将夜间单指数请求量从长历史区间降低为增量区间（除冷启动外），以减少触发封禁的概率。

## REMOVED Requirements
无
