# Tasks
- [x] Task 1: 先确认 `SH/SZ amount+tr` 的可用 provider 方案，再决定 GitHub Runner 稳定顺序。
  - [x] SubTask 1.1: 梳理当前 `SH/SZ amount+tr` 的唯一来源与调用点，确认它们现在为何只依赖 `Eastmoney`
  - [x] SubTask 1.2: 验证候选 provider 是否能稳定提供 `上证/深证` 的 `amount` 与 `tr`，必要时允许 `amount` 和 `tr` 分字段来源不同
  - [x] SubTask 1.3: 明确最小可接受覆盖标准、日期新鲜度标准与单位归一化规则
  - [x] SubTask 1.4: 记录调研结论：`Baostock` 可稳定提供 `sh/sz amount+turn`；`AkShare-东方财富` 不稳，`AkShare-新浪` 缺少 `amount/tr`，`csindex` 字段与指数覆盖不足

- [ ] Task 2: 抽取 `market_turnover` 的独立 provider 链，并接入 `runner-stable`。
  - [ ] SubTask 2.1: 在 `marketLiquidityV5Service.ts` 中为 `SH/SZ amount+tr` 增加序列级 resolver
  - [ ] SubTask 2.2: 将 GitHub Runner 的 `market_turnover` 默认策略改为 `Baostock` 主链路，而不是只走 `Eastmoney`
  - [ ] SubTask 2.3: 保持输出结构与下游流动性计算逻辑不变，避免影响表结构与前端消费

- [ ] Task 3: 增强 probe、日志与 fail-fast 判定。
  - [ ] SubTask 3.1: 在 `refreshMarketBoardPoints.ts` 的 probe 中输出 `market_turnover` 的 provider 顺序、命中的 provider 与覆盖率
  - [ ] SubTask 3.2: 仅当 `market_turnover` 全部 provider 都失败，或覆盖率不足时，才触发硬失败
  - [ ] SubTask 3.3: 保持失败不切换可见 run 的已有行为不变

- [ ] Task 4: 回归验证与 GitHub Runner 场景确认。
  - [ ] SubTask 4.1: 复现“`market_turnover=fetch failed`”场景，验证系统会切到 `Baostock` 主链路或明确报告 `Baostock` 失败
  - [ ] SubTask 4.2: 验证 `runner-stable` 同时覆盖 `HS300 close` 与 `market_turnover`，且后者默认走 `Baostock`
  - [ ] SubTask 4.3: 验证 probe/日志能直接定位失败字段、provider 链、覆盖率与最终失败边界
  - [ ] SubTask 4.4: 运行 `npm run check`、相关测试与 `npm run build`

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
