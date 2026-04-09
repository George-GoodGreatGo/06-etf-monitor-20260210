# Tasks
- [x] Task 1: 更新统一规则与阈值（lowVolSignal）
  - [x] 将偏减仓阈值设置为 85（全局）
  - [x] 调整输出文案：偏加仓 / 偏减仓 / 偏持有 / 偏观望 / —
  - [x] 移除或停用按指数覆盖阈值逻辑（例如 932315=95）

- [x] Task 2: 贯通 UI 一致性（导航/摘要/图表）
  - [x] Home 二级导航“操作建议”使用新的统一规则与文案
  - [x] LowVolOpportunityPanel 摘要卡“建议”使用新的统一规则与文案
  - [x] LowVolOpportunityChart：hover 建议与主图分段着色使用新的统一规则与阈值

- [x] Task 3: 图表“建议规则”完整展示
  - [x] 在说明区展示 5 条规则定义（含缺失规则与 4 色对应）
  - [x] 确保阈值文案与实际计算一致（80/20/85）

- [x] Task 4: 验证与回归
  - [x] 检查 932315 不再使用 95 覆盖；所有指数偏减仓阈值一致为 85
  - [x] 四种颜色状态与文案一致：绿=偏加仓，红=偏减仓，黄=偏持有，蓝=偏观望
  - [x] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
