# 大盘看板：GitHub Runner 数据源 Failover 加固 Spec

## Why
当前大盘看板在 GitHub Actions 回灌时，`source connectivity probe` 能通过，但真正进入分段计算后仍会失败。根因是预检没有覆盖 `HS300 close` 这条关键链路，且现有 `HS300 close` fallback 只在 AkShare 命令成功但返回空数组时才会触发；一旦 AkShare 直接返回错误，`csindex` 备用源就无法接管，导致整段 backfill 在 Runner 网络波动下反复重试后失败。

针对“沪深300收盘点位”已完成本机抽样实测：`AkShare-东方财富` 两条实现（`index_zh_a_hist` / `stock_zh_index_daily_em`）连续失败并报 `ProxyError`；`AkShare-新浪`（`stock_zh_index_daily`）连续成功；`Baostock query_history_k_data_plus(date,close)` 连续成功；`csindex index-perf` 连续成功。后续方案必须以这组实测结果为准，而不是继续把 `AkShare-东方财富` 当作 GitHub Runner 上的稳定主链路。

## What Changes
- 为 backfill 增加“关键路径预检”，覆盖 `HS300 close`、`SH/SZ amount+tr`、`northbound`、`HS300 PE`、`10Y`，避免只探测部分字段就开始长时间回灌。
- 将 `HS300 close` 获取改为可复用的“序列级 provider 链”，不再把 fallback 绑定在某个整包数据源的成功返回上。
- 将 GitHub Runner 上的 `HS300 close` 稳定优先链路明确为：`csindex -> baostock -> akshare:sina`；`AkShare-东方财富` 不再作为该字段的首选或首个回退。
- 为 GitHub Runner 增加“稳定优先”的数据源策略配置，优先使用已实测可用的 provider；手动触发仍允许覆盖。
- 统一 provider 错误分类与日志输出，明确区分 `network/http/empty/waf/python` 等失败原因，便于后续复用到低波、价值择时等批处理任务。
- 保持实现简单：不新增数据库表，不引入新的发布流程，只增强现有拉取、预检、fallback 与日志。

## Impact
- Affected specs:
  - `stabilize-market-board-github-data-sources`
  - `enforce-market-board-nightly-full-backfill`
- Affected code:
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/scripts/refreshMarketBoardPoints.ts`
  - `server/lib/lowVol.ts`
  - `server/lib/akshare.ts`
  - `server/lib/baostock.ts`
  - `server/python/akshare_service.py`
  - `server/python/baostock_service.py`
  - `.github/workflows/refresh-market-board.yml`

## ADDED Requirements
### Requirement: 回灌前必须验证关键数据链路
系统 SHALL 在进入全量 backfill 前，验证构建大盘看板所需的关键序列是否可用，而不是只验证部分辅助字段。

#### Scenario: 关键链路预检失败
- **GIVEN** GitHub Actions 将执行 backfill
- **WHEN** `HS300 close` 或 `SH/SZ amount+tr` 等关键序列无法通过当前 provider 链获取
- **THEN** 系统在进入分段循环前终止本次运行
- **AND** 日志输出失败字段、尝试过的 provider 链与归一化错误类型
- **AND** 不创建新的可见 run

### Requirement: HS300 close fallback 必须独立于 AkShare 整包成功状态
系统 SHALL 将 `HS300 close` 的 fallback 设计为独立 provider 链；即使 AkShare 命令整体失败，也必须继续尝试后续官方 HTTP 备用源。

#### Scenario: Eastmoney 失败且 AkShare 直接报错
- **GIVEN** Eastmoney 在 GitHub Runner 上 `fetch failed`
- **AND** AkShare 返回“替代数据源未能获取沪深300日线”
- **WHEN** 系统需要构建 `HS300 close` 序列
- **THEN** 系统继续尝试 `csindex`、`baostock`、`akshare:sina` 等后续 provider
- **AND** 仅当全部 provider 都失败时，才将该字段判定为不可用

### Requirement: HS300 close 的 GitHub Runner provider 顺序必须以实测稳定性为准
系统 SHALL 根据已验证结果，为 `HS300 close` 使用一条显式的稳定优先 provider 顺序，而不是继续沿用“AkShare-东方财富优先”的旧逻辑。

#### Scenario: schedule 任务计算 HS300 close
- **GIVEN** 工作流运行在 GitHub Runner
- **WHEN** 系统需要拉取 `HS300 close`
- **THEN** 系统按 `csindex -> baostock -> akshare:sina` 的顺序尝试
- **AND** 日志标记每一步是否命中、失败原因与是否进入下一跳
- **AND** 不把 `akshare:index_zh_a_hist` 或 `akshare:stock_zh_index_daily_em` 作为该字段的首选链路

### Requirement: GitHub Runner 使用稳定优先的数据源策略
系统 SHALL 为 GitHub Runner 提供一条稳定优先、可复用的数据源策略，优先走已实测可用的 provider，并允许 workflow_dispatch 显式覆盖。

#### Scenario: schedule 任务启动
- **GIVEN** 工作流由 `schedule` 触发
- **WHEN** 未显式指定数据源策略
- **THEN** 系统使用 GitHub Runner 的稳定优先策略
- **AND** `HS300 close` 默认使用 `csindex -> baostock -> akshare:sina`
- **AND** 日志输出生效策略名与每个关键字段的 provider 顺序

### Requirement: Provider 失败信息可观测且可复用
系统 SHALL 为多数据源链路输出统一、结构化的失败原因，便于脚本快速判断“值得重试”还是“应立即失败”。

#### Scenario: provider 链完全失败
- **GIVEN** 某关键字段的全部 provider 都失败
- **WHEN** 系统输出错误日志
- **THEN** 错误信息包含字段名、provider 顺序、每个 provider 的摘要错误
- **AND** 每个错误被归类为 `network/http/empty/waf/python/unknown` 之一

## MODIFIED Requirements
### Requirement: GitHub Actions 默认数据源策略
系统 SHALL 不再把 `hybrid` 或 `AkShare-东方财富优先` 直接视为 GitHub Runner 的默认最优选择；对定时任务应采用显式、稳定优先的 Runner 策略，并保留手动覆盖能力。

### Requirement: 分段重试前的失败判定
系统 SHALL 在确认关键字段预检已硬失败时直接结束运行，而不是对整段计算继续执行高成本重试。

## REMOVED Requirements
N/A
