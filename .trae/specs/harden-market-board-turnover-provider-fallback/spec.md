# 大盘看板：成交额/换手率 Provider Fallback 加固 Spec

## Why
当前 GitHub Actions 在 `runner-stable` 策略下已经解决了 `HS300 close` 的单点问题，但 `SH/SZ amount+tr` 仍然只依赖 `Eastmoney`。最新报错显示：`HS300 close`、`HS300 PE`、`northbound`、`10Y` 均可用，唯独 `market_turnover` 在 probe 阶段因 `fetch failed` 触发硬失败，导致整次 backfill 直接退出。

这说明当前 `runner-stable` 仍未覆盖“成交额/换手率”这条关键链路。已完成候选源调研：`AkShare-东方财富`（`index_zh_a_hist` / `stock_zh_index_daily_em`）连续失败并报 `ProxyError`；`AkShare-新浪`（`stock_zh_index_daily`）虽然可返回日线，但只有 `date/open/high/low/close/volume`，缺少 `amount` 与 `tr`；`csindex index-perf` 对 `000001` 仅返回 `tradingValue/tradingVol` 且无 `turnover`，对 `399001` 返回空；只有 `Baostock query_history_k_data_plus(date,amount,turn)` 能稳定覆盖 `sh.000001` 与 `sz.399001` 的两项关键字段。因此本次方案应以 `Baostock` 作为 `market_turnover` 的 GitHub Runner 主链路，而不是继续假设存在多个等价可替换源。

## What Changes
- 将 `SH/SZ amount+tr` 从“固定走 `Eastmoney`”改造为独立的序列级 provider 链，不再与 `HS300 close` 共用同一稳定性假设。
- 将 GitHub Runner 上的 `market_turnover` 主链路明确为 `Baostock`；`Eastmoney` 保留为非 Runner 或补充场景使用，不再作为 GitHub Runner 唯一依赖。
- 不将 `AkShare-新浪` 与 `csindex` 视为 `market_turnover` 的等价 fallback：前者缺少 `amount/tr`，后者无法稳定覆盖 `000001 + 399001` 且缺少 `turnover`。
- 调整 backfill probe：对 `market_turnover` 输出 provider 顺序、命中的 provider、失败原因与字段覆盖率，不再只返回笼统的 `fetch failed`。
- 调整 fail-fast 规则：仅当 `SH/SZ amount+tr` 的全部候选 provider 都失败，或覆盖率不足以安全构建流动性序列时，才终止 backfill。
- 保持实现简单：不新增数据库表、不改前端接口；只增强 provider 解析、日志与回灌预检。

## Impact
- Affected specs:
  - `harden-market-board-github-runner-failover`
  - `stabilize-market-board-github-data-sources`
  - `enforce-market-board-nightly-full-backfill`
- Affected code:
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/scripts/refreshMarketBoardPoints.ts`
  - `server/lib/akshare.ts`
  - `server/lib/baostock.ts`
  - `server/python/akshare_service.py`
  - `server/python/baostock_service.py`
  - `.github/workflows/refresh-market-board.yml`

## ADDED Requirements
### Requirement: SH/SZ amount+tr 必须具备独立 provider 链
系统 SHALL 为 `上证/深证` 的 `amount` 与 `tr` 提供独立的 provider 解析链，而不是只依赖 `Eastmoney` 单一入口。

#### Scenario: Eastmoney 在 GitHub Runner 上失败
- **GIVEN** workflow 运行在 GitHub Runner
- **AND** `Eastmoney` 获取 `SH/SZ amount+tr` 时出现 `fetch failed`
- **WHEN** 系统需要构建流动性序列
- **THEN** 系统优先使用 `Baostock` 获取 `sh.000001` 与 `sz.399001` 的 `amount` 和 `turn`
- **AND** 仅当全部 provider 都失败时，才将 `market_turnover` 判定为不可用

### Requirement: market_turnover 的 GitHub Runner 主链路必须以实测字段完整性为准
系统 SHALL 根据已验证结果，为 `market_turnover` 在 GitHub Runner 上使用 `Baostock` 作为主链路，而不是继续把 `AkShare-东方财富`、`AkShare-新浪` 或 `csindex` 当作等价候选。

#### Scenario: schedule 任务构建流动性序列
- **GIVEN** workflow 由 `schedule` 触发
- **WHEN** 系统需要获取 `SH/SZ amount+tr`
- **THEN** 系统优先使用 `Baostock query_history_k_data_plus(date,amount,turn)`
- **AND** 不将 `AkShare-新浪` 用作 `market_turnover` 回退，因为其缺少 `amount` 与 `tr`
- **AND** 不将 `csindex` 用作 `market_turnover` 主链路，因为其字段和指数覆盖不足

### Requirement: market_turnover probe 必须输出可操作的诊断信息
系统 SHALL 在预检阶段对 `market_turnover` 输出结构化日志，能直接说明“失败在哪个 provider、哪个字段、为什么失败”。

#### Scenario: market_turnover 预检失败
- **GIVEN** `market_turnover` 无法通过首选 provider 获取
- **WHEN** 系统输出 probe 日志
- **THEN** 日志包含 provider 顺序、各 provider 的摘要错误、命中的字段覆盖率
- **AND** 错误不应仅表现为笼统的 `fetch failed`

### Requirement: market_turnover 的 fail-fast 以“全链路失败或覆盖率不足”为准
系统 SHALL 仅在 `market_turnover` 的所有候选 provider 都失败，或返回数据无法满足最小覆盖要求时，才终止 backfill。

#### Scenario: 首选 provider 失败但后续 provider 可用
- **GIVEN** 首选 provider 失败
- **AND** 后续 provider 能返回足够的 `amount` 与 `tr`
- **WHEN** 系统执行 backfill
- **THEN** backfill 继续执行
- **AND** `meta.notes` 与日志记录真实命中的 provider 和降级原因

### Requirement: GitHub Runner 的稳定策略必须同时覆盖 HS300 close 与 market_turnover
系统 SHALL 使 `runner-stable` 不仅稳定解决 `HS300 close`，也稳定覆盖 `market_turnover`。

#### Scenario: schedule 任务启动
- **GIVEN** workflow 由 `schedule` 触发
- **WHEN** 未显式指定数据源策略
- **THEN** 系统使用 GitHub Runner 稳定策略
- **AND** `HS300 close` 使用既有稳定链路
- **AND** `market_turnover` 默认使用 `Baostock`

## MODIFIED Requirements
### Requirement: GitHub Actions 默认稳定策略
系统 SHALL 不再把 `runner-stable` 仅视为“HS300 close 稳定化”策略；它必须同时覆盖大盘看板构建所需的全部关键序列，特别是 `SH/SZ amount+tr`，且 `market_turnover` 默认采用 `Baostock` 主链路。

### Requirement: 回灌预检的硬失败边界
系统 SHALL 对 `market_turnover` 使用“多 provider 尝试 + 覆盖率判定”的硬失败标准，而不是在首个 `Eastmoney` 请求失败时立即终止整次 backfill。

## REMOVED Requirements
N/A
