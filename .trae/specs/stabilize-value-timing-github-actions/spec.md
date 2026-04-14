# 价值择时快照任务稳定性修复 Spec

## Why
价值择时快照 GitHub Actions 任务依赖外部数据源（10Y 国债收益率下载、ETF 估值接口），存在偶发 504/网络失败，导致整次任务 exit code 1，进而造成 Supabase 快照长期不更新或间歇性空窗。

## What Changes
- 增强 10Y 国债收益率数据拉取的健壮性：超时、重试、退避、以及“失败不致命”的降级策略。
- 增强 980081（ETF 推算口径）估值拉取的健壮性：超时、重试、以及失败降级为 `pe=null`，不再中断整次任务。
- 调整刷新脚本的失败策略：允许单指数失败但整体任务成功（至少一个指数写入成功），并输出可观测的结构化日志，便于定位失败原因。
- 工作流层面增加网络兼容性配置（例如优先 IPv4），降低 CI 环境下 `fetch failed` 的偶发概率。

## Impact
- Affected specs: 价值择时快照、数据源可靠性、错误可观测性
- Affected code:
  - 服务端数据源：`server/lib/chinamoneyGovBond.ts`、`server/lib/valueTiming.ts`
  - 刷新脚本：`server/scripts/refreshValueTimingSnapshots.ts`
  - GitHub Actions：`.github/workflows/refresh-value-timing-snapshots.yml`

## ADDED Requirements
### Requirement: 10Y 数据源失败降级
系统 SHALL 在获取 10Y 国债收益率失败时进行降级处理，避免单次外部 504 导致整次价值择时快照任务失败。

#### Scenario: 单年份 504 超时
- **WHEN** `downYearBzqx` 拉取某一年数据返回 504 或网络错误
- **THEN** 系统对该年份进行重试（含退避），仍失败则将该年份视为“缺失”，继续计算其余年份与其余指数
- **AND** 在快照 `notes` 中记录缺失原因（包含年份与错误摘要）

#### Scenario: 全年份都失败
- **WHEN** 10Y 数据在本次运行中全部获取失败
- **THEN** 系统 SHALL 不中断进程：仍写入快照，但相关字段（`yield10yPct/spreadPct/spreadPctRank5y`）允许为空
- **AND** UI 通过现有错误/提示机制体现“样本期不足/数据缺失”

### Requirement: ETF 推算估值失败降级
系统 SHALL 在获取 980081 的 ETF 推算 PE 失败时降级为 `pe=null`，不得终止整次任务。

#### Scenario: Eastmoney 接口网络失败
- **WHEN** ETF 估值接口出现 `fetch failed` 或非 2xx
- **THEN** 系统进行有限次重试（含退避与超时）
- **AND** 仍失败则返回 `pe=null`，并在快照 `notes` 中记录失败摘要

### Requirement: 刷新脚本“部分成功”策略
系统 SHALL 支持“部分成功”：单指数失败不应导致整次 Action 失败。

#### Scenario: 3 支指数中 1 支失败
- **WHEN** 价值择时刷新 3 支指数中至少 1 支写入成功，且有 1 支计算/拉取失败
- **THEN** GitHub Actions 任务整体 exit code MUST 为 0
- **AND** 日志中输出 `value_timing.refresh.partial_fail` 事件，包含失败 code 列表与原因摘要

#### Scenario: 全部失败
- **WHEN** 本次运行 3 支指数全部失败或全部未写入
- **THEN** GitHub Actions 任务整体 exit code MUST 为非 0

## MODIFIED Requirements
### Requirement: 独立 GitHub Actions workflow 可运行并写入价值择时快照
workflow SHALL 在外部数据源偶发失败场景下保持可用性：单指数失败不应阻塞其余指数写入，且失败信息必须可观测。

