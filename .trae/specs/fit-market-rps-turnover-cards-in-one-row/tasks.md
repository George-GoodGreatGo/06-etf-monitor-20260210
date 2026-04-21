# Tasks
- [ ] Task 1: 明确成交金额追踪卡片单行完整展示的范围
  - [ ] SubTask 1.1: 确认当前全部目标 ETF 卡片需在同一行完整展示
  - [ ] SubTask 1.2: 确认卡片需要进一步缩小宽度与留白
  - [ ] SubTask 1.3: 确认卡片信息结构与点击联动逻辑保持不变

- [ ] Task 2: 调整成交金额追踪卡片为单行展示布局
  - [ ] SubTask 2.1: 将当前多行网格改为单行排列
  - [ ] SubTask 2.2: 进一步压缩单卡宽度与内部间距
  - [ ] SubTask 2.3: 保留选中态、放量标签和日期信息可读性

- [ ] Task 3: 校对联动与展示稳定性
  - [ ] SubTask 3.1: 验证点击卡片后成交额历史表仍切换到对应 ETF
  - [ ] SubTask 3.2: 校对当前全部目标 ETF 在一行内完整展示
  - [ ] SubTask 3.3: 校对单行布局下视觉密度提升且阅读顺序清晰

- [ ] Task 4: 回归验证与交付
  - [ ] SubTask 4.1: 运行前端检查（如 lint/typecheck）
  - [ ] SubTask 4.2: 验证单行完整展示与更窄卡片符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
