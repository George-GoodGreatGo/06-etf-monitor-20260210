# Tasks
- [x] Task 1: 先确认 `SH/SZ amount+tr` 的可用 provider 方案，再决定 GitHub Runner 稳定顺序。
  - [x] SubTask 1.1: 梳理当前 `SH/SZ amount+tr` 的唯一来源与调用点，确认它们现在为何只依赖 `Eastmoney`
  - [x] SubTask 1.2: 验证候选 provider 是否能稳定提供 `上证/深证` 的 `amount` 与 `tr`，必要时允许 `amount` 和 `tr` 分字段来源不同
  - [x] SubTask 1.3: 明确最小可接受覆盖标准、日期新鲜度标准与单位归一化规则
  - [x] SubTask 1.4: 记录调研结论：`Baostock` 可稳定提供 `sh/sz amount+turn`；`AkShare-东方财富` 不稳，`AkShare-新浪` 缺少 `amount/tr`，`csindex` 字段与指数覆盖不足

- [x] Task 2: 抽取 `market_turnover` 的独立 provider 链，并接入 `runner-stable`。
  - [x] SubTask 2.1: 在 `marketLiquidityV5Service.ts` 中为 `SH/SZ amount+tr` 增加序列级 resolver
  - [x] SubTask 2.2: 将 GitHub Runner 的 `market_turnover` 默认策略改为 `Baostock` 主链路，而不是只走 `Eastmoney`
  - [x] SubTask 2.3: 保持输出结构与下游流动性计算逻辑不变，避免影响表结构与前端消费

- [x] Task 3: 增强 probe、日志与 fail-fast 判定。
  - [x] SubTask 3.1: 在 `refreshMarketBoardPoints.ts` 的 probe 中输出 `market_turnover` 的 provider 顺序、命中的 provider 与覆盖率
  - [x] SubTask 3.2: 仅当 `market_turnover` 全部 provider 都失败，或覆盖率不足时，才触发硬失败
  - [x] SubTask 3.3: 保持失败不切换可见 run 的已有行为不变

- [x] Task 4: 回归验证与 GitHub Runner 场景确认。
  - [x] SubTask 4.1: 复现“`market_turnover=fetch failed`”场景，验证系统会切到 `Baostock` 主链路或明确报告 `Baostock` 失败
  - [x] SubTask 4.2: 验证 `runner-stable` 同时覆盖 `HS300 close` 与 `market_turnover`，且后者默认走 `Baostock`
  - [x] SubTask 4.3: 验证 probe/日志能直接定位失败字段、provider 链、覆盖率与最终失败边界
  - [x] SubTask 4.4: 运行 `npm run check`、相关测试与 `npm run build`

- [x] Task 5: 补齐 GitHub Runner 的 Python 依赖保障，避免 `runner-stable` 命中 `Baostock` 时因缺包失败。
  - [x] SubTask 5.1: 将 `baostock` 显式加入 `server/python/requirements.txt`
  - [x] SubTask 5.2: 校验 workflow 的 Python 依赖安装步骤与 `runner-stable` 实际依赖集合一致
  - [x] SubTask 5.3: 在 probe/日志中把“缺少 Python 模块”与“数据源网络失败”区分输出
  - [x] SubTask 5.4: 重新验证 GitHub Runner 场景下不会再出现 `No module named 'baostock'`

- [ ] Task 6: 加固 `Baostock` 的 JSON 输出解析，覆盖多分段 backfill 场景中的 stdout 噪音问题。
  - [ ] SubTask 6.1: 排查 `runBaostock()` 的 JSON 解析是否过于严格，确认是否需要从 stdout 中提取 JSON 主体而不是只接受纯文本 JSON
  - [ ] SubTask 6.2: 在 `baostock.ts` 或 `baostock_service.py` 中补充诊断信息，至少能记录 stdout 摘要、命令上下文或分段区间
  - [ ] SubTask 6.3: 确认 `Baostock` 在 probe、compute smoke、首段成功后，后续分段仍能稳定返回可解析 JSON
  - [ ] SubTask 6.4: 运行多分段 backfill 相关回归，验证不会再出现 `Baostock 返回非 JSON 内容`

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 6 depends on Task 5
