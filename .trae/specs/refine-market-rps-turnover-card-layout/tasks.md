# Tasks
- [x] Task 1: 明确成交金额追踪摘要卡片的新布局规则
  - [x] SubTask 1.1: 确认卡片头部信息顺序调整为“中文名在前，数字代码在后”
  - [x] SubTask 1.2: 确认移除“已放量”独立标签，仅保留必要状态表达
  - [x] SubTask 1.3: 确认“X个交易日前放量”改为标签样式展示
  - [x] SubTask 1.4: 确认“最近放量日期：YYYY-MM-DD”压缩为单行展示

- [x] Task 2: 合并摘要卡片与 ETF 选择入口
  - [x] SubTask 2.1: 让摘要卡片本身承担 ETF 切换职责
  - [x] SubTask 2.2: 移除成交金额追踪板块中的独立 ETF 选择标签排
  - [x] SubTask 2.3: 保留选中态与切换后明细区同步更新

- [x] Task 3: 优化摘要卡片高度与排版
  - [x] SubTask 3.1: 压缩卡片垂直留白与信息层级
  - [x] SubTask 3.2: 调整状态、日期与名称信息排版，缩小单卡高度
  - [x] SubTask 3.3: 校对不同屏宽下卡片列表的可读性与换行表现

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 运行前端检查（如 lint/typecheck）
  - [x] SubTask 4.2: 验证卡片可直接切换 ETF，且原有明细区联动正常
  - [x] SubTask 4.3: 验证卡片文案、顺序、单行日期与标签展示符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
