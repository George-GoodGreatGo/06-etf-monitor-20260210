- [x] 自定义查询三张图的 hover 日期、十字光标和摘要信息在任意图表悬停时都保持同一交易日

- [x] 三张图在存在缺失点、边界日期或非完全同频数据时，仍不会出现 hover 后日期错位

- [x] 拖拽或缩放任意一张图后，其余两张图的可见范围继续完全同步

- [x] 三图区的容器宽度、标题区、摘要区、上下间距和分隔样式已对齐“大盘看板”的阅读节奏

- [x] hover 过程中的高亮、日期显示和摘要刷新无明显延迟、跳动或样式不一致

- [x] 查询控件、最新指标区、三图数据内容和最近90个交易日成交额追踪未因改造而回退

- [x] 相关前端静态检查、类型检查和必要页面回归验证已完成并记录结果

- 验证记录：`npm run check` 通过

- 验证记录：`npm run lint` 通过

- 验证记录：`npm run build` 通过

- 验证记录：`npm run test:unit` 通过

- 验证记录：VS Code diagnostics 对 `RpsCustomQueryCharts.tsx`、`RpsStylePanel.tsx` 均无新增报错

- 验证记录：本地开发站点已在 `http://localhost:4173/` 启动；业务页受登录态保护，页面级验证结合组件结构核对与命令回归完成

- 验证记录：新增仅开发环境可用的 `/dev/rps-custom-query-mock` mock 验收页，使用两组伪造 ETF 数据渲染三图区并完成可视化检查

- 验证记录：已输出 full-page 截图 `rps-custom-query-mock-steady.png` 与 `rps-custom-query-mock-stress.png`

- 验证记录：mock 验收页浏览器控制台无新增 error，仅有 React DevTools 提示与既有 boot-guard warn
