# Tasks

- [x] Task 1: 更新后端 ETF Detail 接口返回值
  - [x] SubTask 1.1: 修改 `server/routes/etf.ts` 中的 `GET /detail/:code` 接口，在返回的 `data` 对象中补充 `volume`, `turnover`, `turnoverChangePct1d`, `turnoverChangePct7dAvg` 字段（从 `snap.rows` 中获取对应数据）。

- [x] Task 2: 更新前端接口类型定义
  - [x] SubTask 2.1: 修改 `src/utils/etfApi.ts` 中的 `EtfDetail` 类型，增加上述新增字段的定义。

- [x] Task 3: 优化详情页顶部 UI
  - [x] SubTask 3.1: 在 `src/pages/EtfDetail.tsx` 中，修改顶部的 grid 布局（将 `md:grid-cols-3` 扩展为 `md:grid-cols-5` 以容纳更多卡片）。
  - [x] SubTask 3.2: 渲染“当前交易日成交额”、“较昨日变化”、“较7日均”和“90日成交额Z值”的卡片，并应用 `formatPct` 格式化百分比以及红绿颜色样式。
  - [x] SubTask 3.3: 修改右侧的“数据约束”卡片内容，补充完整的数据来源文案。
