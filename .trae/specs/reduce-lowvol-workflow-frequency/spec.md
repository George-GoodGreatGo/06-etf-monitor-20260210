# LowVol 工作流降频与联动回归验证 Spec

## Why
当前 `Refresh LowVol Snapshots` 在北京时间晚间高频运行，并在每次成功后联动触发 `Top100` 和 `RPS` 两个工作流，导致 GitHub Actions 总调用量被成倍放大。若业务目标是“工作日晚间产出一版最终可用数据”，则需要将主触发器收敛到单次执行，同时保留严格的联动与回归验证。

## What Changes
- 将 `Refresh LowVol Snapshots` 的定时触发改为仅在北京时间工作日 `21:35` 自动执行一次。
- 保留 `workflow_dispatch` 手动触发能力，作为失败补跑入口。
- 保持 `Refresh Top100 Snapshot` 与 `Refresh RPS Style Snapshots` 的 `workflow_run` 依赖关系不变，继续在 `LowVol` 成功后自动触发。
- 更新 `LowVol` 工作流中的时间说明注释，使其与实际 cron 完全一致。
- 为本次调度变更增加严格回归验证，覆盖工作流语法、触发时间、手动触发入口和下游联动关系。

## Impact
- Affected specs:
  - 低波快照夜间刷新调度
  - Top100 快照联动刷新
  - RPS 风格快照联动刷新
- Affected code:
  - `.github/workflows/refresh-lowvol-snapshots.yml`
  - `.github/workflows/refresh-top100.yml`
  - `.github/workflows/refresh-rps-style-snapshots.yml`
  - 与工作流校验相关的测试/验证命令

## ADDED Requirements
### Requirement: LowVol 工作日单次夜间刷新
系统 SHALL 将 `Refresh LowVol Snapshots` 的自动调度收敛为北京时间工作日 `21:35` 单次执行。

#### Scenario: 定时触发
- **WHEN** 到达北京时间工作日 `21:35`
- **THEN** GitHub Actions 触发一次 `Refresh LowVol Snapshots`
- **AND** 当天不再因同一 cron 在其他晚间时点重复触发

### Requirement: 保留失败补跑入口
系统 SHALL 继续保留 `Refresh LowVol Snapshots` 的 `workflow_dispatch` 手动触发能力。

#### Scenario: 手动补跑
- **WHEN** 自动任务失败或需要人工重跑
- **THEN** 维护者仍可在 GitHub Actions 控制台手动启动 `Refresh LowVol Snapshots`

### Requirement: 保持下游联动链路
系统 SHALL 在 `Refresh LowVol Snapshots` 成功完成后，继续自动触发依赖其数据的 `Refresh Top100 Snapshot` 与 `Refresh RPS Style Snapshots`。

#### Scenario: 上游成功
- **WHEN** `Refresh LowVol Snapshots` 以 `success` 结束
- **THEN** `Refresh Top100 Snapshot` 可被 `workflow_run` 触发
- **AND** `Refresh RPS Style Snapshots` 可被 `workflow_run` 触发

### Requirement: 严格回归验证
系统 SHALL 在本次改动后执行严格验证，确认调度变更未破坏工作流定义和联动逻辑。

#### Scenario: 配置验证通过
- **WHEN** 完成工作流修改并执行回归验证
- **THEN** 工作流 YAML 语法保持有效
- **AND** `LowVol` 的 cron 精确对应 `UTC 13:35` / 北京时间工作日 `21:35`
- **AND** `workflow_dispatch` 入口仍存在
- **AND** `Top100` 与 `RPS` 对 `Refresh LowVol Snapshots` 的 `workflow_run` 依赖仍存在

## MODIFIED Requirements
### Requirement: LowVol 夜间自动刷新频次
系统 SHALL 不再在北京时间 20:00-22:45 之间按 15 分钟间隔重复触发 `Refresh LowVol Snapshots`，而是仅在北京时间工作日 `21:35` 自动执行一次。

## REMOVED Requirements
### Requirement: LowVol 晚间高频轮询调度
**Reason**: 高频轮询会将 `LowVol` 的运行次数放大到其两个下游工作流，显著增加 GitHub Actions 资源消耗，而当前业务目标仅需要晚间最终版本数据。
**Migration**: 使用新的工作日 `21:35` 单次调度替代原有高频 cron；若当天任务失败，使用 `workflow_dispatch` 手动补跑。
