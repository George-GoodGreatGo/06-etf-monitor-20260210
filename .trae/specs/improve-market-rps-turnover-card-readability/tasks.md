# Tasks
- [x] Task 1: 明确成交金额追踪卡片可读性回调范围
  - [x] SubTask 1.1: 确认需适当增加卡片高度与内部留白
  - [x] SubTask 1.2: 确认需适当增大名称、代码、标签与日期字号
  - [x] SubTask 1.3: 确认单行完整展示与联动逻辑仍需保留

- [x] Task 2: 调整成交金额追踪卡片尺寸与字号
  - [x] SubTask 2.1: 回调卡片高度、圆角或内边距，使卡片更易辨识
  - [x] SubTask 2.2: 回调标题、代码、标签和日期文案字号与行高
  - [x] SubTask 2.3: 保持单行布局下整体信息密度与可读性平衡

- [x] Task 3: 校对单行展示与交互稳定性
  - [x] SubTask 3.1: 验证当前全部目标 ETF 卡片仍在同一行展示
  - [x] SubTask 3.2: 验证点击卡片后成交额历史表仍切换到对应 ETF
  - [x] SubTask 3.3: 校对可读性提升后阅读顺序与选中态仍清晰

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 运行前端检查（如 lint/typecheck）
  - [x] SubTask 4.2: 验证卡片高度与字体回调符合 spec 且未引入布局回归

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
