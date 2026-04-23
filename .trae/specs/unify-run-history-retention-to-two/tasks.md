# Tasks
- [x] Task 1: 统一四模块 run 保留上限常量
  - [x] 将大盘看板、低波机会、价值择时、市场风格 RPS 四个刷新脚本中的 `RUN_HISTORY_KEEP` 从 5 调整为 2
  - [x] 确认发布成功与失败回退路径都使用统一的保留上限

- [x] Task 2: 补齐四模块历史 run 一次性收缩迁移
  - [x] 为四个模块分别裁剪 `*_meta.history_run_ids` 到最近 2 个 run
  - [x] 同步修正 `previous_run_id`，确保它与第二个保留 run 一致或为 `null`
  - [x] 删除 `market_board_point`、`lowvol_index_point`、`value_timing_index_point`、`rps_style_point` 中不在保留列表内的历史 run 数据
  - [x] 保证迁移不切换当前可见 run

- [x] Task 3: 验证读取与回退逻辑在保留 2 个 run 下仍可工作
  - [x] 验证四模块元数据读取后暴露的候选 run 最多为 2 个
  - [x] 验证当前 run 有数据时正常读取
  - [x] 验证当前 run 缺失或异常时，最多只回退到上一个 run

- [x] Task 4: 回归验证与运维确认
  - [x] 检查迁移后四个 `*_meta.history_run_ids` 长度均不超过 2
  - [x] 检查四个点位表仅保留最近 2 个 run 的数据
  - [x] 运行项目校验命令，确认未引入类型或构建错误
  - [x] 记录此次变更对存储占用与回退深度的影响

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 1, Task 2 and Task 3
