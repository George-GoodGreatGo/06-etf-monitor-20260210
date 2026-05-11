# Tasks

- [x] Task 1: 服务端 `rpsStyle.ts` 新增三只ETF到 RPS_TARGET_TICKERS 和 RPS_TICKER_PROFILES
  - [x] 在 `RPS_TARGET_TICKERS` 数组末尾追加 159259.SZ、159967.SZ、159263.SZ
  - [x] 在 `RPS_TICKER_PROFILES` 对象中新增三条 Profile，包含正确的 ticker、code、name、benchmarkIndex

- [x] Task 2: 前端 `RpsStylePanel.tsx` 同步新增三只ETF到 DEFAULT_TICKERS、TURNOVER_TICKERS、ETF_NAME_MAP
  - [x] 在 `DEFAULT_TICKERS` 数组末尾追加 159259.SZ、159967.SZ、159263.SZ
  - [x] 在 `TURNOVER_TICKERS` 中同步追加（自动由 spread DEFAULT_TICKERS 包含）
  - [x] 在 `ETF_NAME_MAP` 中新增三条映射

# Task Dependencies
- Task 1 与 Task 2 无相互依赖，可并行执行
