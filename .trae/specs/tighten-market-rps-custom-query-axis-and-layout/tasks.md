# Tasks
- [x] Task 1: 梳理当前自定义查询三图区与总览页参考实现的差异
  - [x] SubTask 1.1: 明确当前三图 X 轴未严格对齐的原因，包括图高、timeScale、容器留白和单图数据口径差异
  - [x] SubTask 1.2: 提取总览页中 Score 阈值背景带与 RPS/MA50 双线表达的可复用实现点
  - [x] SubTask 1.3: 确认哪些边框、区块和标题说明属于可安全压缩的冗余样式

- [x] Task 2: 实现三图日期 X 轴严格对齐
  - [x] SubTask 2.1: 统一三图的时间轴配置、底部日期区域和可见逻辑范围映射
  - [x] SubTask 2.2: 处理起点归一重算、空值过滤与非完全同频数据下的轴对齐问题
  - [x] SubTask 2.3: 确保拖拽、缩放、切换 ETF 和 hover 后仍保持严格对齐

- [x] Task 3: 压缩三图区布局并简化视觉容器
  - [x] SubTask 3.1: 缩小图表标题、说明文案和摘要区尺寸
  - [x] SubTask 3.2: 下调三张图高度与区块留白，使三图尽量在一屏内完整展示
  - [x] SubTask 3.3: 清理多余边框、包裹层和重装饰背景，同时保留必要信息层级

- [x] Task 4: 下沉总览页的两项图表表达能力
  - [x] SubTask 4.1: 在 RPS 起点归一视图中新增目标 ETF 的 RPS MA50 虚线走势，并纳入 hover 解读
  - [x] SubTask 4.2: 在 MA50 归一视图（Score 走势）中新增阈值背景色带，并保证背景位于主线之下
  - [x] SubTask 4.3: 校对新增虚线和背景带不会破坏现有联动、摘要和性能表现

- [x] Task 5: 执行严格回归测试与验收
  - [x] SubTask 5.1: 运行 `npm run check`、`npm run lint`、`npm run build`、`npm run test:unit`
  - [x] SubTask 5.2: 使用 mock 验收页或等价页面验证 X 轴严格对齐、一屏压缩、背景带和虚线效果
  - [x] SubTask 5.3: 回归自定义查询页的查询输入、最新指标、三图联动和成交额追踪，确认无明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 2, Task 3 and Task 4

# Delivery Notes
- 已在 `RpsCustomQueryCharts.tsx` 中将三图统一到同一交易日坐标系；`Score` 图对空值使用同日时间占位，避免逻辑范围同步时出现 X 轴错位。
- 已在 `RpsCustomQueryCharts.tsx` 中新增 Score 阈值背景色带，以及起点归一视图中的目标 ETF `RPS MA50` 虚线参照。
- 已在 `RpsStylePanel.tsx` 中移除自定义查询三图区外层冗余卡片，压缩指标卡、标题、说明、图高和内边距，降低边框层级。
- 已通过 `npm run check`、`npm run lint`、`npm run build`、`npm run test:unit`，并用 `/dev/rps-custom-query-mock` 完成可视化验收与截图留证。
