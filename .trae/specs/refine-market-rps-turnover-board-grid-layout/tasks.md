# Tasks
- [x] Task 1: 明确公告板五列网格与卡片精简规则
  - [x] SubTask 1.1: 确认卡片进一步缩窄以适配每行 5 个
  - [x] SubTask 1.2: 确认“最近放量日期”文案改为“最近放量日”
  - [x] SubTask 1.3: 确认超过 5 个卡片时自动换行
  - [x] SubTask 1.4: 确认移除公告板外层黄色底色区块

- [x] Task 2: 调整成交金额追踪公告板网格布局
  - [x] SubTask 2.1: 将卡片列表改为每行 5 个的网格布局
  - [x] SubTask 2.2: 缩小单卡宽度并校正文案
  - [x] SubTask 2.3: 删除黄色底色容器，精简信息层级

- [x] Task 3: 校对联动与布局稳定性
  - [x] SubTask 3.1: 验证点击卡片后表格联动仍正确
  - [x] SubTask 3.2: 校对 5 列网格在常用屏宽下的换行与可读性
  - [x] SubTask 3.3: 校对公告板整体横向利用率与视觉紧凑度

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 运行前端检查（如 lint/typecheck）
  - [x] SubTask 4.2: 验证五列布局、文案更新与容器删除均符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
