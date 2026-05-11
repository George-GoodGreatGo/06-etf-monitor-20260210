# 市场风格RPS新增三只ETF Ticker Spec

## Why

当前市场风格RPS页面覆盖6只ETF（创业板、科创50、恒生科技、沪深300、中证A500、中证1000），缺少成长/价值风格细分维度的代表ETF。新增国证成长100（159259）、创业板动量成长（159967）、国证价值100（159263）三只ETF，使RPS矩阵覆盖更全面的成长/价值风格对比。

## What Changes

* 服务端 `RPS_TARGET_TICKERS` 新增 159259.SZ、159967.SZ、159263.SZ

* 服务端 `RPS_TICKER_PROFILES` 新增三只ETF的完整Profile（含跟踪指数信息）

* 前端 `DEFAULT_TICKERS` 与 `TURNOVER_TICKERS` 同步新增

* 前端 `ETF_NAME_MAP` 新增三只ETF的中文名称

## Impact

* Affected specs: market-rps-custom-query, market-rps-turnover-panel

* Affected code:

  * `server/lib/rpsStyle.ts` — RPS\_TARGET\_TICKERS、RPS\_TICKER\_PROFILES

  * `src/components/RpsStylePanel.tsx` — DEFAULT\_TICKERS、TURNOVER\_TICKERS、ETF\_NAME\_MAP

## ADDED Requirements

### Requirement: 新增三只ETF到RPS动量与成交额体系

系统 SHALL 在市场风格RPS页面的Score矩阵、动量趋势、成交额追踪中覆盖以下三只ETF：

| Ticker    | 代码     | 名称         | 跟踪指数              |
| --------- | ------ | ---------- | ----------------- |
| 159259.SZ | 159259 | 国证成长100ETF | 成长100（980080）     |
| 159967.SZ | 159967 | 创业板成长ETF   | 创业板动量成长指数（399296） |
| 159263.SZ | 159263 | 国证价值100ETF | 国证价值100指数（980081） |

#### Scenario: RPS矩阵展示新增ETF

* **WHEN** 用户打开市场风格RPS总览页

* **THEN** Score矩阵应展示9只ETF（原有6只 + 新增3只）

* **AND** 动量趋势图应包含新增ETF的曲线

#### Scenario: 成交额追踪覆盖新增ETF

* **WHEN** 用户查看RPS成交额追踪面板

* **THEN** 成交额卡片应包含新增3只ETF（共10只，含512890）

#### Scenario: 自定义查询支持新增ETF

* **WHEN** 用户在RPS自定义查询中输入新增ETF代码（如159259）

* **THEN** 系统应正常返回该ETF的RPS/MA50/Score数据及图表

## REMOVED Requirements

无
