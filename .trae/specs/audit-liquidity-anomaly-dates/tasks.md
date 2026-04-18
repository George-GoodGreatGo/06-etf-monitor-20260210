# Tasks
- [x] Task 1: 对 2024-12-18 与 2025-03-10 做发布值与当前重算值的逐项对账。
  - [ ] SubTask 1.1: 提取这两个日期在已发布 run、缓存快照或 Supabase 可见数据中的实际值
  - [x] SubTask 1.2: 用当前代码按全历史窗口重算这两个日期及前后若干交易日的 `amount / tr / northMoney / amountPct / trPct / northPct / v5 / v5Pct / equityBondPct`
  - [x] SubTask 1.3: 输出差异清单，明确异常存在于“旧发布值”还是“当前处理链路”

- [x] Task 2: 直接取源归因异常字段，确认最小守卫方案应落在哪个分支。
  - [x] SubTask 2.1: 直接从 `Eastmoney` 获取 2024-12-18 与 2025-03-10 的 `amount + tr`
  - [x] SubTask 2.2: 直接从 `Baostock` 获取同日期的 `amount + tr` 并核对差异
  - [x] SubTask 2.3: 直接获取 `northMoney` 并确认其是否支持截图中的极端低 `v5`
  - [x] SubTask 2.4: 输出结论：异常更可能落在 `Baostock turnover` 的 `tr / trPct`，而不是 `northbound`

- [x] Task 3: 整理最小守卫方案，优先保护 `tr` 主链路。
  - [x] SubTask 3.1: 将 `tr` 的主源固定为 `Eastmoney`，`Baostock` 仅作辅助参考或回退诊断
  - [x] SubTask 3.2: 为 `tr<=0`、异常低值、跨源冲突增加脏值守卫
  - [x] SubTask 3.3: 在回灌/发布流程中加入“`amountPct` 与 `northPct` 正常但 `trPct` 极端塌陷”的发布拦截
  - [x] SubTask 3.4: 保持现有 run 原子发布和失败不切换语义不变

- [x] Task 4: 增加最小冒烟测试，覆盖异常日期。
  - [x] SubTask 4.1: 对 2024-12-18 与 2025-03-10 运行指定日期重算冒烟，验证 `v5 / v5Pct` 不再异常塌陷
  - [x] SubTask 4.2: 验证脏值守卫命中时日志能指出日期、字段、来源与拦截原因
  - [x] SubTask 4.3: 运行 `npm run check`、相关测试与 `npm run build`

# Task Dependencies
- Task 3 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
