# Tasks
- [ ] Task 1: 明确复现与定位“前端截止 2020-05-22”的根因
  - [ ] 盘点前端表格/图表数据来源与 API 返回的 run_id/max_date
  - [ ] 核对 Supabase `market_board_meta` 当前可见 run 与表中最新日期是否一致
  - [ ] 确认是否存在“run 已切换但数据不完整/字段缺失”或“API 缓存读到旧 run”的路径

- [ ] Task 2: 增加回灌批次完成度校验（不通过不切换）
  - [ ] 在回灌脚本计算并输出关键统计：max_date、行数、近2年窗口各关键字段非空率
  - [ ] 将完成度校验作为切换 `current_run_id` 的硬门槛（失败则退出码非0）
  - [ ] （可选）把统计落到 `market_board_meta`（completed_at/max_date/coverage），便于 API 回退选择

- [ ] Task 3: 修复股债字段长期为 null（PE/10Y/股债 value & pct）
  - [ ] 梳理股债链路依赖：PE 来源、10Y 来源、对齐交易日与缺口处理
  - [ ] 为 10Y 引入更稳健的获取策略（优先已有安全实现/缓存，其次备选数据源）
  - [ ] 将“股债链路不可生成”视为回灌失败条件（避免写入缺关键字段的新可见 run）

- [ ] Task 4: API 读取回退 + 返回数据有效性校验（避免空白图表）
  - [ ] 读取 `market_board_meta` 时对 current_run 做可用性判断（max_date/行数/关键字段覆盖）
  - [ ] current_run 不可用时回退 previous_run 或最近一次通过校验的 run（同时在 meta.notes 说明）
  - [ ] 对 API payload 做有效性校验：空数组/全 null/日期不递增一律返回错误（含 code/msg）

- [ ] Task 5: 前端端到端表现修复与回归
  - [ ] 表格视图：日期应跟随 Supabase 最新可见 run（不再停在 2020-05-22）
  - [ ] 图表：不再渲染空白；在数据不可用时展示明确错误态
  - [ ] 更新必要的指标说明/notes（仅当与修复相关）

- [ ] Task 6: 自动化验证与手工验收
  - [ ] 增加/更新单元测试：完成度校验计算、API 回退选择、payload 有效性校验
  - [ ] 本地跑通回灌脚本的 dry-run 或短区间回灌，并验证不会切换到不完整 run
  - [ ] 本地启动并验证页面表格与图表符合预期

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2
- Task 5 depends on Task 4
- Task 6 depends on Task 2, Task 4, Task 5
