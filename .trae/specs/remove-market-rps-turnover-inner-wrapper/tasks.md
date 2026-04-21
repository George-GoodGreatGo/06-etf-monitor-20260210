# Tasks
- [x] Task 1: 明确成交金额追踪内层容器移除的范围
  - [x] SubTask 1.1: 确认移除的是“放量公告板 + 成交额历史表”外层统一包裹区块
  - [x] SubTask 1.2: 确认公告板和表格自身内容结构仍需保留
  - [x] SubTask 1.3: 确认卡片切换与表格联动逻辑不变

- [x] Task 2: 调整成交金额追踪板块层级结构
  - [x] SubTask 2.1: 删除公告板与表格外层统一边框容器
  - [x] SubTask 2.2: 调整公告板与表格的间距，使其直接归属于模块本身
  - [x] SubTask 2.3: 保持现有表格和公告板的阅读顺序清晰

- [x] Task 3: 校对交互与视觉层级
  - [x] SubTask 3.1: 验证点击卡片后表格联动仍正确
  - [x] SubTask 3.2: 校对去除统一容器后视觉层级更简洁
  - [x] SubTask 3.3: 校对不同屏宽下布局仍稳定

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 运行前端检查（如 lint/typecheck）
  - [x] SubTask 4.2: 验证外层包裹边框已删除且功能无回归

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
