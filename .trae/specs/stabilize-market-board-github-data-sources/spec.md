# 大盘看板：GitHub Actions 数据源稳定性增强 Spec

## Why
当前 GitHub Actions 在回灌大盘看板数据时，可能因 Runner 网络环境导致部分中文数据源不可达（例如 Eastmoney `fetch failed`、AkShare 上游失败），从而无法完成 backfill。需要补充可切换/多级回退的数据源策略，并在失败时保持线上可用的上一批次数据不被替换。

## What Changes
- 增强 `MARKET_DATA_SOURCE` 策略：为 GitHub Actions 提供更稳健的默认组合（可配置），并在核心字段缺失时中止切换 `run_id`（保持旧数据可见）。
- 新增“沪深300点位”备用数据源：复用现有 `lowVol.ts` 中的 `csindex`/`cnindex` 指数点位抓取能力，作为 Eastmoney/AkShare 失败时的补位来源（仅用于 close，不改变其它字段口径）。
- 改造回灌脚本：在分段回灌中对每段输出明确标记“使用了哪些数据源/是否降级”，并在全量失败时不更新 `market_board_meta.current_run_id`。
- GitHub Actions 支持通过 workflow input 或 env 覆盖数据源策略（例如 `financedata` / `eastmoney-http` / `akshare-first` / `hybrid`）。

## Impact
- Affected specs:
  - `enforce-market-board-nightly-full-backfill`（回灌成功率与降级策略）
  - `revamp-market-board-supabase-only`（数据更新稳定性）
- Affected code:
  - `server/lib/marketLiquidityV5Service.ts`（数据源策略与回退）
  - `server/lib/lowVol.ts`（复用指数点位抓取作为备用）
  - `server/scripts/refreshMarketBoardPoints.ts`（分段回灌的降级与不切换保障）
  - `.github/workflows/refresh-market-board.yml`（可配置数据源与日志）

## ADDED Requirements
### Requirement: GitHub 回灌失败不切换可见 run
系统 SHALL 在回灌过程中发生不可恢复错误时，不更新 `market_board_meta.current_run_id`，确保前端仍可读取上一批次完整数据。

#### Scenario: 分段计算失败
- **GIVEN** 当前可见 run 为 oldRun
- **WHEN** 回灌某个分段在最大重试后仍失败
- **THEN** 系统终止本次回灌
- **AND** 不得切换 current_run_id（保持 oldRun 可见）
- **AND** 日志输出失败的分段范围与数据源错误原因

### Requirement: 沪深300 close 具备备用数据源
系统 SHALL 在无法通过主策略获取沪深300日线 close 时，使用备用数据源补齐 close 序列（仅补 close，不改变其它指标口径）。

#### Scenario: Eastmoney/AkShare 失败时回退
- **GIVEN** Eastmoney/AkShare 无法获取沪深300 close
- **WHEN** 系统需要生成沪深300 close 序列
- **THEN** 系统使用 csindex 或 cnindex 备用源拉取 close
- **AND** 若备用源也不可用，则该分段失败并触发“不切换可见 run”

### Requirement: 数据源策略可配置
系统 SHALL 支持在 GitHub Actions 中配置 `MARKET_DATA_SOURCE`，并在日志中输出实际生效策略。

## MODIFIED Requirements
### Requirement: GitHub Actions 默认数据源策略
系统 SHALL 为 GitHub Actions 提供一条“优先成功率”的默认策略（可按配置覆盖），并保证失败不影响线上可见数据。

## REMOVED Requirements
N/A

