# 低波机会：夜间增量拉取 + 增量计算（方案 B）Spec

## Why
当前夜间刷新脚本在“增量回补 5 天”模式下仍调用 `getLowVolIndexSeries` 做全套指标计算。由于股息率/利差计算至少依赖 252 个交易日的 PRI/TRI 对齐历史，短窗口回源会导致 `overlap < 253`，从而所有指数刷新失败。

为在“用户访问只读 Supabase 快照”的前提下进一步降低上游请求量与封禁风险，夜间刷新需要改为：
- 回源仅拉取“必要的原始点位”（PRI/TRI close 的增量区间）
- 在本地基于历史快照与增量点位做增量计算与合并写回（不再要求上游每次返回长历史）

## What Changes
- 夜间刷新脚本改造为“增量拉取 + 增量计算”：
  - 读取 Supabase 最新快照（历史 `payload.series`，含 close、ma、bias、dividendYield、spread、分位等）
  - 回源仅拉取：
    - PRI：`[lastDataDate - bufferDays, endDate]`
    - TRI：为计算股息率需要的最小区间（覆盖 `lookbackDays=252` 的回溯 + bufferDays）
  - 对“新增/需要回补的交易日”重新计算指标，并与历史 series 合并写回
- 冷启动保持：无快照时拉取 `N=10 年` 的 PRI/TRI 并计算全量 series 写回
- 风控策略保持：串行队列、抖动等待、WAF 熔断终止本轮、非 WAF 最多重试 1 次

## Impact
- Affected specs: 夜间快照刷新机制（提升可靠性并减少封禁风险）
- Affected code:
  - `server/scripts/refreshLowVolSnapshots.ts`：实现增量拉取 + 增量计算
  - `server/lib/lowVol.ts`：抽出/复用“原始序列拉取”与“单日指标计算”能力（避免脚本重复实现）
  - `server/lib/supabaseRest.ts`：夜间脚本读取快照继续支持 service role（已具备）

## ADDED Requirements
### Requirement: 增量拉取窗口定义
系统 SHALL 使用以下窗口进行增量拉取：
- `bufferDays = 5`（回补）
- `lookbackDays = 252`（股息率回溯）
- `endDate = 今日自然日（YYYYMMDD）`（仅用于请求上游；写回 data_date 以最新交易日为准）

#### Scenario: 有快照
- **GIVEN** Supabase 存在该指数最新快照，且 `payload.series` 为数组
- **WHEN** 夜间刷新执行该指数
- **THEN** PRI 拉取区间为 `[lastDataDate - bufferDays, endDate]`
- **AND** TRI 拉取区间至少覆盖 `[endDate - (lookbackDays + bufferDays + extraDays), endDate]`，其中 `extraDays` 默认为 60（覆盖周末/节假日缺口）

### Requirement: 增量计算与合并写回
系统 SHALL 在本地基于“历史 series + 增量点位”计算并写回，不依赖上游返回长历史。

#### Scenario: 计算范围
- **WHEN** PRI/TRI 增量点位合并到历史后
- **THEN** 系统仅对需要更新的尾部交易日重新计算：
  - 均线与 BIAS（60/250）
  - BIAS 分位（5 年窗口≈1260，minPeriods=252）
  - 股息收益率（滚动 1 年，252 交易日回溯）
  - 利差（核心）与利差分位（5 年窗口≈1260，minPeriods=252）
- **AND** 历史已存在且不受影响的更早日期保持不变

#### Scenario: 合并规则
- **WHEN** 将更新后的尾部片段写回到历史 series
- **THEN** 按 `date` 去重（同 date 以新计算结果覆盖）
- **AND** 最终按 date 升序排序
- **AND** 写回 Supabase 的 `data_date` 取合并后序列最后一个交易日（不强行等于自然日）

### Requirement: 冷启动 N=10 年
系统 SHALL 在无快照或快照不可用时执行冷启动：
- 拉取 `[10年前01-01, endDate]` 的 PRI/TRI
- 计算全量 series
- 写回 Supabase

### Requirement: 风控友好与可观察
系统 SHALL 保持以下行为：
- 串行队列 + 抖动等待
- 非 WAF 失败最多重试 1 次（退避 + 抖动）
- WAF/熔断触发则终止本轮
- Actions 日志逐指数输出：模式（cold_start / incremental_compute）、拉取区间、写回 data_date、耗时

## MODIFIED Requirements
### Requirement: 不再使用短窗口调用全量计算
系统 SHALL 不再在夜间增量模式下直接调用 `getLowVolIndexSeries(startDate短窗口)` 来计算全指标，以避免 `overlap < 253` 的必然失败。

## REMOVED Requirements
无

