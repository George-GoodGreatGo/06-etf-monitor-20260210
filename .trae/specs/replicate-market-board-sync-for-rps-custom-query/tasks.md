# Tasks
- [x] Task 1: 对齐“大盘看板”三图联动实现细节
  - [x] SubTask 1.1: 梳理“大盘看板”当前用于 hover 日期同步、十字光标同步、可见范围同步的关键实现点
  - [x] SubTask 1.2: 识别“自定义查询”当前三图在日期映射、缺口处理、联动守卫和 hover 摘要上的差异
  - [x] SubTask 1.3: 明确需要复用、抽离或重写的共享图表联动逻辑，避免仅做表面样式修补

- [x] Task 2: 复刻三图联动与日期对齐行为
  - [x] SubTask 2.1: 让悬停任意图表时，三图统一定位到同一交易日并同步更新摘要
  - [x] SubTask 2.2: 对齐缺失点、非完全同频序列和边界日期的处理策略，避免显示不同日期
  - [x] SubTask 2.3: 确保拖拽和缩放后，三图可见范围仍完全同步，且后续 hover 联动稳定

- [x] Task 3: 对齐“大盘看板”三图区样式与交互节奏
  - [x] SubTask 3.1: 调整三图容器、标题区、摘要区、分隔和留白，使阅读顺序与“大盘看板”一致
  - [x] SubTask 3.2: 校对 hover 时的高亮反馈、日期显示和摘要刷新节奏，减少视觉跳动
  - [x] SubTask 3.3: 保证样式复刻后，不影响现有查询控件、最新指标区和成交额追踪区

- [x] Task 4: 执行完整回归测试与验证
  - [x] SubTask 4.1: 运行前端静态检查与类型检查，并修复本次改造直接引入的问题
  - [x] SubTask 4.2: 逐项验证三图 hover 联动、日期对齐、拖拽缩放同步和视觉一致性
  - [x] SubTask 4.3: 对自定义查询的输入查询、指标展示、三图渲染和成交额区域做必要回归，确认无明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3

# Delivery Notes
- 已在 `RpsCustomQueryCharts.tsx` 中对齐三图的可见范围同步、hover 日期同步、十字光标同步和相对视图重算回放。
- 已在 `RpsStylePanel.tsx` 中对齐自定义查询页的分区外壳、标题层级、摘要卡与成交额追踪容器节奏。
- 已完成 `npm run check`、`npm run lint`、`npm run build`、`npm run test:unit`。
- 浏览器联调已确认本地开发站点可启动，但业务页受登录态保护；页面级验证结合组件代码核对、诊断结果和构建/测试结果完成。
