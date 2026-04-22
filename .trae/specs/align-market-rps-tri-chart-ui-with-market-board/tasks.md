# Tasks
- [x] Task 1: 盘点自定义查询三联动图表与“大盘看板”主图加副图 UI 的差异
  - [x] SubTask 1.1: 明确图表容器、标题区、分隔方式、留白和背景层级的差异项
  - [x] SubTask 1.2: 明确 hover 日期字样、指标标签、摘要排列和辅助文案的差异项
  - [x] SubTask 1.3: 列出必须保留的业务信息，避免对标过程中丢失自定义查询必要信息

- [x] Task 2: 将三联动图表容器样式调整为对标“大盘看板”的主图加副图结构
  - [x] SubTask 2.1: 消除当前三图区“3 个独立区块”的视觉割裂感
  - [x] SubTask 2.2: 对齐主图与两张副图的标题排版、区块边距、分隔和容器层级
  - [x] SubTask 2.3: 校对不同桌面视口下的整体观感，确保阅读节奏接近“大盘看板”

- [x] Task 3: 将图表标题、hover 字样和摘要文案对标“大盘看板”
  - [x] SubTask 3.1: 统一日期字样、指标标签、hover 信息排列顺序和位置
  - [x] SubTask 3.2: 清理仅属于当前自定义查询页的非必要特有文案
  - [x] SubTask 3.3: 在保留必要业务信息的前提下，让标题与 hover 表达尽量复用“大盘看板”风格

- [x] Task 4: 回归三图联动与页面可读性
  - [x] SubTask 4.1: 验证样式对齐后，三图 hover、十字光标、可见范围和严格 X 轴对齐仍正常
  - [x] SubTask 4.2: 验证切换 ETF 后标题、摘要和 hover 信息不会错位或残留旧状态
  - [x] SubTask 4.3: 验证样式收敛后没有引入信息缺失或视觉重叠

- [x] Task 5: 完成验收与验证记录
  - [x] SubTask 5.1: 运行相关前端检查与构建验证
  - [x] SubTask 5.2: 通过 mock 验收页或等价页面对比“大盘看板”与自定义查询图表区效果
  - [x] SubTask 5.3: 记录像素级对标已覆盖的范围与残余差异

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3 and Task 4

# Delivery Notes
- 已在 `src/components/charts/RpsCustomQueryCharts.tsx` 将三图区改造成单一大容器内的“主图 + 2 副图”结构，图内标题 badge、容器边框、背景层级和分隔节奏对齐 `MarketLiquidityChart.tsx`。
- 已将自定义查询图表的 hover 信息改为与大盘看板一致的右上角悬浮卡，统一采用“日期 + 指标标签 + 数值”的枚举式信息组织。
- 已保留业务必需信息：标的代码/名称、分母基准、前复权价格、RPS Score、RPS 起点归一与 MA50 参照线。
- 已验证样式改造后，三图共享 hover、十字光标、可见范围同步、默认最近 1 年窗口和严格 X 轴对齐逻辑均未回退。
- 已运行 `npm run check`、`npm run lint`、`npm run build`，并使用 `/dev/rps-custom-query-mock` 对 `159915.SZ` 与 `510300.SH` 两组样本完成可视化验收。
- 像素级对标已覆盖图表区主容器、badge 标题、价格轴宽度、底部单时间轴与 hover 浮层；残余差异主要仍在 mock 验收页外围说明卡与真实大盘看板页的上下文环境，不属于本次图表区对标范围。
