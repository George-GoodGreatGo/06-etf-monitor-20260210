# Tasks
- [x] Task 1: 增加按指数覆盖阈值的能力
  - [x] 在 lowVolSignal 中提供按 indexCode 获取阈值的入口（默认阈值 + 覆盖表）
  - [x] 将信号计算函数改为可注入阈值或传入 indexCode（避免散落硬编码）

- [x] Task 2: 将 932315 偏减仓阈值调整为 95 并贯通 UI
  - [x] Home 二级导航“操作建议”计算改为按 indexCode 使用阈值
  - [x] LowVolOpportunityPanel 摘要卡“建议”计算改为按 indexCode 使用阈值
  - [x] LowVolOpportunityChart：分段着色与 hover 建议改为按 indexCode 使用阈值
  - [x] LowVolOpportunityChart：规则说明区域偏减仓阈值文案随 indexCode 变化（932315 显示 95，其它显示 79）

- [x] Task 3: 验证与回归
  - [x] 选择 932315 时：BIAS分位(3年) 在 95 附近前后切换，建议与分段颜色符合预期
  - [x] 选择 H30269/932365 时：仍按 79 触发偏减仓，行为不回退
  - [x] TypeScript 类型检查与构建通过（按项目现有命令）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
