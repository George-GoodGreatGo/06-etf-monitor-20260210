# Tasks
- [x] Task 1: 抽取可复用的关键序列 provider 链，先解决 `HS300 close` 的 fallback 粒度问题。
  - [x] SubTask 1.1: 从 `marketLiquidityV5Service.ts` 中拆出序列级 resolver，支持按顺序尝试多个 provider 并返回统一错误摘要
  - [x] SubTask 1.2: 基于实测结果，为 `HS300 close` 建立稳定优先链路：`csindex -> baostock -> akshare:sina`
  - [x] SubTask 1.3: 为 resolver 增加最小数据量与日期覆盖校验，避免空数组或尾部过旧数据被误判为成功
  - [x] SubTask 1.4: 将 `AkShare-东方财富`（`index_zh_a_hist` / `stock_zh_index_daily_em`）从 GitHub Runner 的 `HS300 close` 首选链路中移除，避免继续触发已验证的 `ProxyError`
  - [x] SubTask 1.5: 如需继续保留 `AkShare`，新增独立的 `akshare:sina` close provider，而不是复用当前 `market-board-daily` 的东方财富链路

- [x] Task 2: 增强 backfill 预检与 fail-fast 逻辑，阻止“预检通过但首段必失败”的运行。
  - [x] SubTask 2.1: 在 `refreshMarketBoardPoints.ts` 的 probe 中新增 `HS300 close` 与 `SH/SZ amount+tr` 关键链路检查，并输出命中的 provider
  - [x] SubTask 2.2: 在进入正式分段循环前增加一个代表性 compute smoke，确认关键字段可真正构建流动性序列
  - [x] SubTask 2.3: 当关键字段被判定为硬失败时直接退出，并输出字段名、provider 链与错误分类

- [x] Task 3: 调整 GitHub Actions 默认策略与日志，让定时任务使用稳定优先配置。
  - [x] SubTask 3.1: 为 workflow 增加显式 Runner 稳定策略名，schedule 默认使用该策略，workflow_dispatch 可覆盖
  - [x] SubTask 3.2: 在运行日志中输出策略名、关键字段 provider 顺序、命中的 provider 与失败摘要
  - [x] SubTask 3.3: 保持现有 run 原子发布与失败不切换逻辑不变

- [x] Task 4: 回归验证本次问题与防回归场景。
  - [x] SubTask 4.1: 保留本次实测结论作为基线：`AkShare-东方财富` 连续失败，`AkShare-新浪` / `Baostock close` / `csindex` 连续成功
  - [x] SubTask 4.2: 验证“Eastmoney fetch failed + AkShare 返回 HS300 日线错误”时，`HS300 close` 仍可被 `csindex / baostock / akshare:sina` 后续 provider 接管，或在预检阶段明确失败
  - [x] SubTask 4.3: 验证 schedule 默认策略和 workflow_dispatch 覆盖行为符合预期
  - [x] SubTask 4.4: 验证回灌日志能定位失败字段与 provider 链，且 `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2
- Task 4 depends on Task 3
