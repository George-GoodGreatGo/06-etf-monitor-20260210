# Tasks
- [x] Task 1: 明确自定义查询三视图纵向布局的改造边界
  - [x] SubTask 1.1: 确认当前三图区中哪些结构仅服务于左右分栏布局
  - [x] SubTask 1.2: 明确三图纵向堆叠后需要保留的标题、摘要和联动信息
  - [x] SubTask 1.3: 对照“大盘看板”确认纵向阅读顺序与日期对齐要求

- [x] Task 2: 将三视图改为纵向并列布局
  - [x] SubTask 2.1: 移除当前主图+侧栏副图的左右混排结构
  - [x] SubTask 2.2: 将三张图调整为统一宽度、自上而下排列
  - [x] SubTask 2.3: 校对纵向布局下标题、间距与容器样式的可读性

- [x] Task 3: 保持三图日期对齐与联动体验
  - [x] SubTask 3.1: 验证纵向布局后 hover 联动仍指向同一交易日
  - [x] SubTask 3.2: 验证拖拽和缩放后的日期范围仍完全同步
  - [x] SubTask 3.3: 校对顶部 hover 摘要或同日信息展示与三图布局一致

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 运行前端检查（如 `lint`、`typecheck`）并修复直接相关问题
  - [x] SubTask 4.2: 验证三图已纵向并列、日期对齐且原有交互未回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
