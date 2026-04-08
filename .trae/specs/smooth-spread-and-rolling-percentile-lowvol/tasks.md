# Tasks

- [x] Task 1: 后端扩展利差输出（raw + 平滑 + 10年分位）
  - [x] 在 `server/lib/lowVol.ts` 增加 `spreadRawPct` 计算
  - [x] 明确股息收益率观测窗口为滚动1年（252交易日）并更新对应字段与 meta.notes
  - [x] 增加 EWMA(半衰期6个月≈126交易日) 的 `spreadSmoothPct` 序列生成（缺失不推进）
  - [x] 增加 `spreadPctRank10y`（window≈2520，minPeriods=252，基于 raw）
  - [x] 更新 `meta.notes` 说明口径与参数

- [x] Task 2: 前端视图与展示调整
  - [x] `LowVolOpportunityPanel` 增加/调整按钮：利差（平滑）、利差分位(10年)
  - [x] `LowVolH30269Chart` 支持展示 `spreadSmoothPct` 与 `spreadPctRank10y`
  - [x] tooltip/标题标注：股息收益率=滚动1年（PRI/TRI推算）；平滑仅用于展示；分位基于 raw

- [x] Task 3: 回归验收
  - [x] 指标抽样：对齐若干日期验证 spreadRaw/spreadSmooth/pctRank10y 范围与缺失规则
  - [x] 运行 `npm run check` 与 `npm run lint` 无新增 error

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
