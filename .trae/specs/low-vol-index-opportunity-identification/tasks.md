# Tasks

- [x] Task 1: 明确数据源与字段口径（csindex）
  - [x] 调研并确认 csindex 可提供 H30269 的收盘点位序列与股息率序列的 API/字段
  - [x] 确认股息率单位为 %（或可换算为 %），并写入 meta.notes

- [x] Task 2: 后端实现低波指数序列 API
  - [x] 扩展/新增服务端实现：H30269 点位与股息率拉取（含缓存/重试/日期规范化）
  - [x] 复用 `fetchGovBond10yYieldPctByDate`，拼接 10Y 序列并按日期对齐
  - [x] 实现指标计算：ma250、bias250、biasPct3y、spreadPct、spreadPctRank3y
  - [x] 新增路由：`GET /api/lowvol/h30269`（支持 startDate/endDate 可选；默认全量）

- [x] Task 3: 前端新增同级 Tab 与面板
  - [x] 在 `Home.tsx` 增加 `tab=lowvol`、按钮、渲染分支
  - [x] 新增 `LowVolOpportunityPanel`，加载 API 并展示数据状态（来源/日期/是否快照）
  - [x] 新增图表组件：5 视图切换 + tooltip + Y 轴单位显示

- [x] Task 4: 回归与验收
  - [x] 指标正确性抽样：随机抽取日期验证 bias 与 ma250 关系、分位值范围 0-100
  - [x] 运行：`npm run check` 与 `npm run lint` 无新增 error

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 1-3
