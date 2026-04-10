# Tasks
- [x] Task 1: 指数切换行布局调整（右侧放置基准开关）
  - [x] 在低波机会 Tab 的指数切换行使用左右布局：左侧指数胶囊，右侧 BIAS基准开关
  - [x] 在窄屏下保持可用（允许换行但层级清晰）

- [x] Task 2: iOS 风格开关组件
  - [x] 将“BIAS基准”切换实现为 iOS 风格滑动开关（checkbox + 样式）
  - [x] 状态映射：关闭=SMA250（默认），打开=SMA60
  - [x] 旁边展示当前档位文案（SMA250 / SMA60）

- [x] Task 3: 移除图表内重复控件
  - [x] 从 LowVolOpportunityChart 顶部控制区移除 BIAS基准切换控件（避免层级混淆）
  - [x] 保持图表仍可接收 biasBasis 并正确联动展示/建议

- [x] Task 4: 验证与回归
  - [x] 切换开关后，对所有指数的 BIAS/分位/建议立即生效，且切换指数不重置
  - [x] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 3 depends on Task 1-2
- Task 4 depends on Task 1-3
