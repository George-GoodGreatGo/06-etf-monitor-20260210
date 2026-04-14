# Tasks
- [x] Task 1: 设计并落地 Supabase 逐日点位表（10年+增量写入）
  - [x] 确定表名与字段（优先新增逐日点位表；避免每日重复存全量大 JSON）
  - [x] 建立 `data_date` 主键或唯一约束（保证日期不重复）
  - [x] 增加必要索引（例如按 `data_date` 排序/范围查询）

- [x] Task 2: 后端 Supabase 读写封装
  - [x] 新增按日期范围读取（例如 readMarketBoardRange(start,end)）
  - [x] 新增逐日 upsert 写入（upsertMarketBoardPoint）
  - [x] 统一 meta 字段（fetched_at/source/source_type/notes）写入与读取

- [x] Task 3: GitHub Actions 定时任务（北京时间工作日 20:00）
  - [x] 新增 workflow schedule：20:00 北京时间（12:00 UTC）工作日触发
  - [x] 实现“最近 5 个交易日”选择逻辑（跳过非交易日）
  - [x] 拉取所需原始字段 + 计算派生字段（分位/v5/v5Pct/股债分位）
  - [x] 对最近 5 个交易日执行覆盖写入（upsert），避免重复日期
  - [x] Action 日志输出：写入了哪些日期、写入条数、异常原因

- [x] Task 4: 冷启动 backfill（10年历史）
  - [x] 增加 workflow_dispatch 手动入口（参数：start/end 或默认“近10年”）
  - [x] 分批拉取与写入（避免单次超时），幂等 upsert
  - [x] 验证：重复运行不产生重复日期、数据可完整覆盖近10年

- [x] Task 5: 大盘看板 API 改为只读 Supabase
  - [x] 调整 `/api/market/liquidity/v5`（或新增专用路由）为只读 Supabase 数据表
  - [x] 返回结构保持前端可用（series/equityBond 等），但不再回源外部 API
  - [x] 当 Supabase 数据不足时返回可读错误（用于前端提示“等待定时任务/先跑 backfill”）

- [x] Task 6: 前端展示完全依赖 Supabase
  - [x] 确认前端仍只调用本项目 API（API 内部仅读 Supabase，不触发外部回源）
  - [x] 调整页面提示文案：来源=Supabase，展示“最后更新日期/更新时间”
  - [x] 移除或禁用“强制刷新回源”相关参数与提示（如存在）

- [x] Task 7: 回归验证
  - [x] 模拟冷启动：清空/无数据时，前端提示明确且不触发外部回源
  - [x] 模拟增量：写入最近 5 个交易日后，前端可正常展示且日期无重复
  - [x] `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 2
- Task 6 depends on Task 5
- Task 7 depends on Task 3 and Task 5
