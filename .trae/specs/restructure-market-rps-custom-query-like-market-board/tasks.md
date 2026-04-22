# Tasks
- [ ] Task 1: 梳理“大盘看板”主图加副图模式与当前自定义查询差异
  - [ ] SubTask 1.1: 确认大盘看板主图、副图在图高、标题、信息展示和交互控制上的关键实践
  - [ ] SubTask 1.2: 确认当前自定义查询顶部信息卡与成交额追踪区的冗余点
  - [ ] SubTask 1.3: 确认默认最近1年视窗与拖拽边界限制的实现入口

- [ ] Task 2: 将三联动图表重构为主图加副图
  - [ ] SubTask 2.1: 调整三图主次层级、图高、标题和摘要信息，使其对齐“大盘看板”的主图加副图阅读顺序
  - [ ] SubTask 2.2: 对齐三图之间的 hover、十字光标、范围同步和信息展示节奏
  - [ ] SubTask 2.3: 保证重构后仍维持严格 X 轴对齐

- [ ] Task 3: 调整默认视窗与拖拽边界
  - [ ] SubTask 3.1: 让三图默认加载最近1年的数据
  - [ ] SubTask 3.2: 限制拖拽与缩放边界，禁止进入无数据日期区域
  - [ ] SubTask 3.3: 确保切换 ETF 后默认视窗正确重置，并继续保持联动

- [ ] Task 4: 整合顶部信息并改造成交额追踪区
  - [ ] SubTask 4.1: 合并或下沉冗余信息卡，强化搜索框与查询动作露出
  - [ ] SubTask 4.2: 将成交金额追踪扩展为过去250个交易日
  - [ ] SubTask 4.3: 移除成交金额追踪区刺眼的白色高亮边框，并保持可读性

- [ ] Task 5: 执行严格回归测试与验收
  - [ ] SubTask 5.1: 运行 `npm run check`、`npm run lint`、`npm run build`、`npm run test:unit`
  - [ ] SubTask 5.2: 使用 mock 验收页或等价页面验证主图加副图布局、默认最近1年视窗和边界限制
  - [ ] SubTask 5.3: 回归搜索输入、最新指标、三图联动、成交额追踪和相关样式，确认无明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 2, Task 3 and Task 4
