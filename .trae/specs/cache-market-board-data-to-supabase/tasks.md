# Tasks

- [x] Task 1: 设计 Supabase 表结构与约束（防重复 dataDate）
  - [ ] 定义表名（建议：`market_board_daily`）与字段（data_date、meta、payload、created_at、updated_at）
  - [ ] 建立唯一约束：`data_date` unique（或主键）
  - [ ] 明确 payload 存储方式（建议 JSONB：`data` / `meta`）

- [x] Task 2: 新增 Supabase 读写封装（server/lib/supabaseRest.ts）
  - [ ] readLatestMarketBoardSnapshot：按 data_date desc 读取最新一条
  - [ ] upsertMarketBoardSnapshot：按 data_date upsert 写入（幂等）
  - [ ] 可选：readMarketBoardSnapshotByDate（按 data_date 精确取）

- [x] Task 3: 改造大盘数据获取链路为“优先快照，缺失回源并回写”
  - [ ] 在 `getMarketLiquidityV5` 中加入读取 Supabase 最新快照的快速路径
  - [ ] 回源成功后写回 Supabase（upsert）
  - [ ] 增加 `meta.sourceType`（primary-realtime / fallback-realtime / supabase-snapshot）

- [x] Task 4: 增加定时刷新入口（API 路由 + 鉴权）
  - [ ] 新增后端路由：例如 `POST /api/admin/market/refresh`（仅用于定时任务）
  - [ ] 鉴权：基于环境变量的 secret token（header 或 query）
  - [ ] 行为：触发回源计算并 upsert；若无新交易日则不产生重复记录

- [x] Task 5: 配置工作日 22:00 定时任务（优先 GitHub Actions）
  - [ ] 新增/复用 GitHub Actions schedule（14:00 UTC = 22:00 北京时间）
  - [ ] 工作流中调用刷新入口，并记录执行结果
  - [ ] 确保失败告警或日志可追溯（至少在 Action log 可见）

- [x] Task 6: 回归与验收
  - [ ] 本地/预览环境验证：读快照优先，缺失回源并回写
  - [ ] 验证：同一 dataDate 多次运行不会产生重复行（upsert 生效）
  - [ ] 验证：UI 状态栏来源声明与 meta.sourceType 一致
  - [ ] 运行：`npm run check` 与 `npm run lint` 无新增 error

# Task Dependencies
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 4
- Task 6 depends on Task 1-5
