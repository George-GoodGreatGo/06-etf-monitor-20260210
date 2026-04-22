- [x] 自定义查询三图已重构为“主图 + 2个副图”的样式，且主次层级、标题和摘要信息符合“大盘看板”阅读节奏

- [x] 三图在主图加副图结构下仍保持 hover、十字光标、日期摘要、范围同步和严格 X 轴对齐

- [x] 三图初始加载与切换 ETF 后都默认展示最近1年的数据

- [x] 用户拖拽或缩放三图时，视窗不会进入无数据日期区域

- [x] 页面顶部信息卡已整合，搜索框与查询操作的露出得到强化

- [x] 成交金额追踪已展示过去250个交易日，且不再使用刺眼的白色高亮边框

- [x] 本次重构后，查询输入、最新指标、三图联动、成交额追踪和 mock 验收页均未发生明显回退

- [x] 相关类型检查、Lint、构建、单测和可视化验收均已完成并记录结果

- 验证记录：`npm run check` 通过

- 验证记录：`npm run lint` 通过

- 验证记录：`npm run build` 通过

- 验证记录：`npm run test:unit` 通过

- 验证记录：`npx tsx server/tests/rpsStyleTurnover.test.ts` 通过，新增覆盖 250 日成交额窗口断言

- 验证记录：VS Code diagnostics 对 `RpsCustomQueryCharts.tsx`、`RpsStylePanel.tsx`、`DevRpsCustomQueryMock.tsx`、`rpsStyle.ts`、`rpsStyleTurnover.test.ts` 均无新增报错

- 验证记录：`/dev/rps-custom-query-mock` 页面快照已显示“主图 + 2个副图”“默认视窗：初始与切换 ETF 后默认聚焦最近1年”等新文案

- 验证记录：截图 `rps-custom-query-market-board-layout-top.png` 验证了更新后的 mock 验收页顶部说明与样本切换入口

- 验证记录：截图 `rps-custom-query-market-board-layout-viewport.png` 验证了主图加副图结构的基础渲染

- 验证记录：截图 `rps-custom-query-market-board-layout-stress-top.png` 验证了压力样本切换后的页面结构稳定性

- 验证记录：mock 验收页浏览器控制台无新增 error
