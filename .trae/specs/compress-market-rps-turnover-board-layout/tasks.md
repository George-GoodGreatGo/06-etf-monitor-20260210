# Tasks
- [ ] Task 1: 明确公告板进一步压缩的布局规则
  - [ ] SubTask 1.1: 确认所有目标 ETF 选择卡片改为单行优先布局
  - [ ] SubTask 1.2: 确认移除卡片右上角“当前查看”文字提示
  - [ ] SubTask 1.3: 确认删除公告板下方详情信息块
  - [ ] SubTask 1.4: 确认卡片选中态与表格联动仍需保留

- [ ] Task 2: 调整成交金额追踪公告板布局
  - [ ] SubTask 2.1: 将所有 ETF 选择卡片收敛为单行展示
  - [ ] SubTask 2.2: 保留卡片选中态样式，但移除“当前查看”文案
  - [ ] SubTask 2.3: 删除“当前标的 / 对应基准指数 / RPS分母ETF / 数据交易日”信息块

- [ ] Task 3: 校对表格联动与紧凑度
  - [ ] SubTask 3.1: 验证点击卡片后成交额历史表仍切换到对应 ETF
  - [ ] SubTask 3.2: 校对公告板与表格之间的间距和整体纵向占用
  - [ ] SubTask 3.3: 校对不同屏宽下单行布局的可用性

- [ ] Task 4: 回归验证与交付
  - [ ] SubTask 4.1: 运行前端检查（如 lint/typecheck）
  - [ ] SubTask 4.2: 验证单行卡片、移除“当前查看”和删除详情信息块均符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
