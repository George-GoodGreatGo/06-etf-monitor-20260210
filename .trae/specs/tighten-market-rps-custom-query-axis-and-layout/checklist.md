- [x] 自定义查询三张图的日期 X 轴在初始渲染、拖拽缩放和切换 ETF 后都保持严格对齐

- [x] 三张图在存在空值、缺口或起点归一重算时，时间轴刻度与底部日期区域仍不发生错位

- [x] 三图区的标题、说明、图高和留白已明显压缩，常见桌面视口下更接近一屏完整阅读

- [x] 三图区及相邻摘要区域的边框、包裹层和装饰样式已简化，阅读噪音降低

- [x] RPS起点归一视图已新增目标 ETF 的 RPS MA50 虚线走势，并与主线共享同一日期解读

- [x] MA50归一视图（Score走势）已新增阈值背景区间，且不会遮挡主线和 hover 信息

- [x] 本次压缩与增强后，查询控件、最新指标、三图联动、成交额追踪和 mock 验收页均未发生明显回退

- [x] 相关类型检查、Lint、构建、单测和可视化验收均已完成并记录结果

- 验证记录：`npm run check` 通过

- 验证记录：`npm run lint` 通过

- 验证记录：`npm run build` 通过

- 验证记录：`npm run test:unit` 通过

- 验证记录：VS Code diagnostics 对 `RpsCustomQueryCharts.tsx`、`RpsStylePanel.tsx`、`DevRpsCustomQueryMock.tsx`、`App.tsx` 均无新增报错

- 验证记录：`/dev/rps-custom-query-mock` 页面快照已显示“X轴严格对齐”“Score 背景阈值区间”“起点归一 MA50 虚线”等新文案

- 验证记录：截图 `rps-custom-query-tight-lower.png` 验证了压缩后的摘要区与价格图布局

- 验证记录：截图 `rps-custom-query-tight-charts.png` 验证了 Score 背景带与起点归一 MA50 虚线同时生效

- 验证记录：截图 `rps-custom-query-tight-stress-charts.png` 验证了压力样本下背景带、虚线与压缩图高仍稳定渲染

- 验证记录：mock 验收页浏览器控制台无新增 error，仅有 React DevTools 提示与既有 boot-guard warn
