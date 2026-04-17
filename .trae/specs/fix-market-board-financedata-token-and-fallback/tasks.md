# Tasks
- [ ] Task 1: 识别并跳过 financeData 的 token 失效
  - [ ] 在 marketLiquidityV5Service.ts 中：解析 financeData 响应的 code/msg，判定“token 不对”并在分段范围内禁用该源
  - [ ] 将“主源失效”写入分段日志与 meta.notes，避免对同分段重复重试 financeData

- [ ] Task 2: 沪深300 close 多级回退实现与校验
  - [ ] 在 lowVol.ts 或共享模块中提供 fetchHs300CloseFallback（支持 csindex/cnindex）
  - [ ] 在 marketLiquidityV5Service.ts 将 Eastmoney → AkShare → csindex/cnindex 作为回退链路，仅补 close
  - [ ] 增加样本量与非空校验（如至少≥60点，避免空数据误判成功），失败抛出明确错误

- [ ] Task 3: GitHub Actions 默认数据源策略修订
  - [ ] 将 refresh-market-board.yml 的 backfill 默认 `MARKET_DATA_SOURCE` 设置为 hybrid（Eastmoney-first）
  - [ ] 支持通过 workflow input/env 覆盖，日志输出实际生效策略

- [ ] Task 4: 预探测（probe）与分段可观测性增强
  - [ ] 在 refreshMarketBoardPoints.ts 分段前执行快速 probe（financeData token、Eastmoney连通性）
  - [ ] 每段输出：生效数据源、是否触发回退层级、样本量、失败原因，并写入 meta.notes

- [ ] Task 5: 回归与构建验证
  - [ ] 使用小区间（例如 20160101..20170331）本地运行 backfill 验证 token 跳过与回退成功
  - [ ] 验证 `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 4 depends on Task 2
- Task 5 depends on Task 3 and Task 4
