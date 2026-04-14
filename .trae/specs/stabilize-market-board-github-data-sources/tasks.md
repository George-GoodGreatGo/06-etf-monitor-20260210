# Tasks
- [x] Task 1: 设计并落地 GitHub Actions 的数据源策略配置
  - [x] 在 workflow 中支持显式设置 `MARKET_DATA_SOURCE`（env 或 input），并在日志输出生效值
  - [x] 为“回灌 backfill”与“增量 incremental”分别定义推荐默认值

- [x] Task 2: 增强沪深300 close 的备用数据源
  - [x] 复用/抽取 `lowVol.ts` 的 csindex/cnindex 指数点位抓取能力，提供 `fetchHs300CloseFallback()`
  - [x] 在 `marketLiquidityV5Service.ts` 中，当 HS300 日线获取失败时，使用该 fallback 补齐 close
  - [x] 为 fallback 增加最小数据量校验（避免空数组误判为成功）

- [x] Task 3: 回灌脚本的“失败不切换”保障与可观测性
  - [x] 在 backfill 过程中仅当所有分段写入成功时才更新 `market_board_meta.current_run_id`
  - [x] 分段失败时：输出失败分段范围、当前数据源策略、最后错误原因；退出码非0
  - [x] 保持旧 run 可见，且不执行清理旧 run

- [x] Task 4: 回归验证
  - [x] 本地用小区间（例如 1-2 个季度）运行 backfill，验证 fallback 与不切换逻辑
  - [x] 验证 `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
