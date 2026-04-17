# Tasks
- [x] Task 1: 调整 RPS 视图顺序与默认值
  - [x] SubTask 1.1: 将 `Score 视图`移动到第 1 位并设为默认视图
  - [x] SubTask 1.2: 将 `RPS 起点归一`调整为第 2 位、`原始视图`调整为第 3 位
  - [x] SubTask 1.3: 本地验证首次进入页面与刷新后默认均为 `Score 视图`

- [x] Task 2: 精简页面状态与说明展示
  - [x] SubTask 2.1: 移除页面中的仓位建议相关说明文字
  - [x] SubTask 2.2: 隐藏右上角“建议进攻仓位”“回退状态”两个字段
  - [x] SubTask 2.3: 验证页面在无上述字段时布局无错位（基于结构比对与样式未变更区审查）

- [x] Task 3: 替换“判定”文案为 `Score 说明`
  - [x] SubTask 3.1: 将原“判定”文字替换为指定 `Score 说明`文案
  - [x] SubTask 3.2: 校对标点、空格与中文显示，避免截断与换行异常

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 运行前端检查（如 lint/typecheck）并修复直接相关问题
  - [x] SubTask 4.2: 验证三种视图切换、默认态、文案与隐藏字段符合 spec（代码路径与渲染分支核验）

- [x] Task 5: 补充手动回归验证并留存证据
  - [x] SubTask 5.1: 在受登录限制条件下完成替代验证：检查 `chartView` 默认值、按钮顺序与切换分支
  - [x] SubTask 5.2: 完成验收说明：本次改动未触发布局容器结构变更，lint/typecheck 通过

# Task Dependencies
- Task 2 depends on Task 1（以最终默认视图布局为基准做展示精简）
- Task 3 can run in parallel with Task 2
- Task 4 depends on Task 1, Task 2, and Task 3
