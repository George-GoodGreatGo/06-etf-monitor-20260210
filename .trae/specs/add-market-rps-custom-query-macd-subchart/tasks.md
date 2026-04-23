# Tasks
- [x] Task 1: 明确自定义查询新增 MACD 副图的数据与交互边界
  - [x] SubTask 1.1: 盘点当前自定义查询图表数据结构，确认 MACD `(8, 21, 5)` 所需输入与计算位置
  - [x] SubTask 1.2: 确认 MACD 副图插入第一顺位后，对现有副图顺序、标题和布局的影响范围
  - [x] SubTask 1.3: 明确 MACD 副图需要复用的 hover、十字光标、可见范围和日期对齐逻辑

- [x] Task 2: 在自定义查询中实现 MACD 副图
  - [x] SubTask 2.1: 为单 ETF 图表数据增加 MACD `(8, 21, 5)` 结果，输出 `DIFF`、`DEA` 与柱体序列
  - [x] SubTask 2.2: 在图表区将 MACD 作为第一张副图渲染，并让原有副图顺延
  - [x] SubTask 2.3: 保持现有图表颜色、图例和信息层级清晰，不引入与旧副图冲突的表达

- [x] Task 3: 保证新增副图与现有图表严格日期对齐
  - [x] SubTask 3.1: 让 MACD 副图接入当前统一日期坐标与缺口处理逻辑
  - [x] SubTask 3.2: 验证悬停任意图表时，MACD 与其余图表保持同一交易日解读
  - [x] SubTask 3.3: 验证拖拽、缩放、切换 ETF 后，MACD 副图可见范围仍与其他图表同步

- [x] Task 4: 执行回归验证并完成交付
  - [x] SubTask 4.1: 运行直接相关检查，如 `check`、`lint`、`build` 或等价校验
  - [x] SubTask 4.2: 验证 MACD 副图位置、参数 `(8, 21, 5)`、日期对齐和联动行为全部符合预期
  - [x] SubTask 4.3: 回归原有副图、摘要区与成交额追踪，确认无明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3

# Delivery Notes
- 已在 `RpsCustomQueryCharts.tsx` 中新增 `MACD(8,21,5)` 第一副图，输出 `DIFF`、`DEA` 与 `MACD` 柱体，并将原有副图顺延。
- 已修复 `turnoverSeries = []` 默认参数导致的运行时循环更新问题，改为稳定常量引用，mock 验收页控制台不再出现 `Maximum update depth exceeded`。
- 代码核对确认 `MACD` 已接入与主图、Score、相对强弱、RSI 相同的可见范围同步与十字光标同步链路。
- `npm run check`、`npm run lint`、`npm run build` 均已通过，`RpsCustomQueryCharts.tsx` 无新增 diagnostics。
- 浏览器验收已覆盖 `/dev/rps-custom-query-mock` 与 `/dev/rps-custom-query-live`：确认 MACD 第一副图存在、Live 页摘要区正常、成交额追踪表正常、切换样本/真实数据页均无新增控制台 error。
