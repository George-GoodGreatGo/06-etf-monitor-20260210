# Tasks
- [x] Task 1: 复现与定位“北向资金总成交额恒定”的根因
  - [x] 在本地请求较长区间（默认区间/最近2年）观察 north_money 是否出现大量重复值
  - [x] 检查北向资金数据源接口是否存在分页限制（pageSize/pageNumber/pages）
  - [x] 确认是否因“只拉取第一页 + fillForward”导致后续日期被同一值填充

- [x] Task 2: 修复 hkex 北向资金总成交额拉取的分页逻辑
  - [x] 在 `server/lib/hkex.ts` 实现自动分页：循环请求 pageNumber=1..pages，合并 rows 并按 trade_date 去重
  - [x] 保持返回结构不变：`Array<{ trade_date: string; north_money: number | null }>`
  - [x] 增加健壮性：异常重试、空数据处理与缓存键不变或合理更新

- [x] Task 3: 服务端数据完整性校验与缓存版本隔离
  - [x] 在 `server/lib/marketLiquidityV5Service.ts` 增加北向资金序列“最新日期落后”校验，避免大段 fill-forward 形成常数
  - [x] 更新 `meta.notes` 说明分页策略与缺失处理
  - [x] 更新 calcVersion（或等价机制）以隔离旧快照/缓存

- [x] Task 4: 回归验证
  - [x] 手动验证：表格视图“北向资金总成交额(亿元)”不再整段为同一数值（至少最近 90/180/2年应有波动）
  - [x] 手动验证：northPct/v5 仍正常计算（允许数值回溯变化）
  - [x] `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
