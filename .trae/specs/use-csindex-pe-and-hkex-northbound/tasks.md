# Tasks

- [x] Task 1: 调研并固化 CSIndex 沪深300 PE 接口口径与字段映射
  - [x] 确认接口路径、参数（indexCode/startDate/endDate）与返回字段（tradeDate、peg/pe）
  - [x] 明确 `pe` 的口径/单位（按接口字段原样；在 notes 写清楚）
  - [x] 明确日期格式与现有 `trade_date` 对齐策略（YYYYMMDD vs YYYY-MM-DD）

- [x] Task 2: 实现 CSIndex 数据拉取模块
  - [x] 新增 `server/lib/csindex.ts`：请求、解析、重试（轻量）、缓存（短缓存）与错误包装
  - [x] 输出统一结构：`Array<{ trade_date: string; pe: number | null }>`

- [x] Task 3: 调研 HKEX 北向资金“净流入/净买入”免费数据获取路径
  - [x] 明确 HKEX 数据来自官方统计页或其数据接口（优先结构化接口，其次抓取页面表格）
  - [x] 明确字段口径与单位（以输出字段为准，notes 写清楚）
  - [x] 明确可获取的历史跨度与更新时点（盘后/实时）

- [x] Task 4: 实现 HKEX 北向资金拉取模块
  - [x] 新增 `server/lib/hkex.ts`：请求、解析、轻量重试、缓存与错误包装
  - [x] 输出统一结构：`Array<{ trade_date: string; north_money: number | null }>`

- [x] Task 5: 将 CSIndex PE 与 HKEX 北向资金接入大盘流动性V5计算
  - [x] 修改 `server/lib/marketLiquidityV5Service.ts`：在 Serverless 默认策略下组合 Eastmoney + CSIndex + HKEX + Chinabond
  - [x] 保持“无推测值”原则：缺失字段为 null；分位与指数计算不使用常数填充
  - [x] `meta.source/meta.notes` 标注每个字段的来源与缺失原因

- [x] Task 6: 回归与验收
  - [x] 验证：沪深300 PE 恢复可用，股债利差与股债分位恢复可用
  - [x] 验证：北向资金净流入恢复可用，北向分位恢复可用
  - [x] 验证：Serverless 环境不依赖 Python，不触发 financedata 403
  - [x] 运行：`npm run check` 与 `npm run lint` 通过（不新增 error）

# Task Dependencies
- Task 5 depends on Task 2 and Task 4
- Task 6 depends on Task 5
