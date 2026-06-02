# Tasks

- [x] 任务 1: 收敛 LowVol 定时调度
  - [x] 修改 `.github/workflows/refresh-lowvol-snapshots.yml` 的 `schedule`，将自动触发改为 `UTC 13:35 / 北京时间工作日 21:35` 的单次 cron。
  - [x] 同步更新该工作流内的时间说明注释，确保“UTC 与北京时间的换算”和“工作日单次触发”描述准确一致。
  - [x] 保留 `workflow_dispatch` 手动触发入口，不引入其他自动时点。

- [x] 任务 2: 保持联动链路不变
  - [x] 检查 `.github/workflows/refresh-top100.yml`，确认其仍通过 `workflow_run` 依赖 `Refresh LowVol Snapshots`。
  - [x] 检查 `.github/workflows/refresh-rps-style-snapshots.yml`，确认其仍通过 `workflow_run` 依赖 `Refresh LowVol Snapshots`。
  - [x] 如需最小化调整，仅允许修改注释或说明，不改变两个下游工作流的现有依赖行为。

- [x] 任务 3: 执行严格回归验证
  - [x] 验证三个相关工作流 YAML 文件语法有效，且关键字段未损坏。
  - [x] 验证 `Refresh LowVol Snapshots` 的 cron 精确为 `35 13 * * 1-5`，对应北京时间工作日 `21:35`。
  - [x] 验证 `Refresh LowVol Snapshots` 仍保留 `workflow_dispatch`。
  - [x] 验证 `Refresh Top100 Snapshot` 与 `Refresh RPS Style Snapshots` 仍保留 `workflow_run -> Refresh LowVol Snapshots` 依赖。
  - [x] 运行仓库内可执行的相关检查命令，并记录结果；若存在无法执行的外部依赖检查，需明确说明原因与剩余风险。

- [x] 任务 4: 整理交付说明
  - [x] 汇总本次降频后的新触发策略、预计资源节省方向和失败补跑方式。
  - [x] 汇总回归验证结果，明确通过项、未覆盖项和建议观察点。

# Task Dependencies
- 任务 2 depends on 任务 1
- 任务 3 depends on 任务 1-2
- 任务 4 depends on 任务 3
