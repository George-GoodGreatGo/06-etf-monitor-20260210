# Tasks
- [x] Task 1: 梳理“大盘看板”主图加副图模式与当前自定义查询差异
  - [x] SubTask 1.1: 确认大盘看板主图、副图在图高、标题、信息展示和交互控制上的关键实践
  - [x] SubTask 1.2: 确认当前自定义查询顶部信息卡与成交额追踪区的冗余点
  - [x] SubTask 1.3: 确认默认最近1年视窗与拖拽边界限制的实现入口

- [x] Task 2: 将三联动图表重构为主图加副图
  - [x] SubTask 2.1: 调整三图主次层级、图高、标题和摘要信息，使其对齐“大盘看板”的主图加副图阅读顺序
  - [x] SubTask 2.2: 对齐三图之间的 hover、十字光标、范围同步和信息展示节奏
  - [x] SubTask 2.3: 保证重构后仍维持严格 X 轴对齐

- [x] Task 3: 调整默认视窗与拖拽边界
  - [x] SubTask 3.1: 让三图默认加载最近1年的数据
  - [x] SubTask 3.2: 限制拖拽与缩放边界，禁止进入无数据日期区域
  - [x] SubTask 3.3: 确保切换 ETF 后默认视窗正确重置，并继续保持联动

- [x] Task 4: 整合顶部信息并改造成交额追踪区
  - [x] SubTask 4.1: 合并或下沉冗余信息卡，强化搜索框与查询动作露出
  - [x] SubTask 4.2: 将成交金额追踪扩展为过去250个交易日
  - [x] SubTask 4.3: 移除成交金额追踪区刺眼的白色高亮边框，并保持可读性

- [x] Task 5: 执行严格回归测试与验收
  - [x] SubTask 5.1: 运行 `npm run check`、`npm run lint`、`npm run build`、`npm run test:unit`
  - [x] SubTask 5.2: 使用 mock 验收页或等价页面验证主图加副图布局、默认最近1年视窗和边界限制
  - [x] SubTask 5.3: 回归搜索输入、最新指标、三图联动、成交额追踪和相关样式，确认无明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 2, Task 3 and Task 4

# Delivery Notes
- 已在 `RpsCustomQueryCharts.tsx` 中将三图重构为“主图 + 2个副图”，并保留 hover、十字光标、日期摘要、范围同步与严格 X 轴对齐。
- 已在 `RpsCustomQueryCharts.tsx` 中引入默认最近 1 年视窗与逻辑范围 clamp，拖拽和缩放不会进入无数据日期区域，切换 ETF 后也会重置到同一默认窗口。
- 已在 `RpsStylePanel.tsx` 中整合顶部信息卡，保留当前标的/日期/Score/基准分母的轻量摘要，强化搜索框与查询按钮的视觉露出。
- 已在 `server/lib/rpsStyle.ts` 中将自定义查询的成交额追踪窗口扩展到 250 个交易日；前端同步更新标题与展示列表，并移除表格外层白色高亮边框。
- 已通过 `npm run check`、`npm run lint`、`npm run build`、`npm run test:unit`、`npx tsx server/tests/rpsStyleTurnover.test.ts`，并使用 `/dev/rps-custom-query-mock` 完成可视化验收与截图留证。
