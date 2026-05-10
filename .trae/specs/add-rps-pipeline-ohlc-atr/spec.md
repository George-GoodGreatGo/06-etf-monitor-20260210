# RPS 管道增加 OHLC 与 ATR 真实波幅 Spec

## Why
Baseline加强风控（V6.1）的 ATR-3x 在回测中基于东方财富真实 OHLC 计算 True Range（`max(H-L, |H-prevC|, |L-prevC|)`），典型 ETF 日 ATR(14) 约为 3~4%。但当前 RPS 管道（Supabase `rps_style_point` → 后端 API → 前端）全线只有收盘价，前端只能用 `|close[i]-close[i-1]|` 近似，典型值仅 1~1.5%，导致 ATR-3x 阈值大幅偏低，任何普通回调都触发——线上全部风控卖都被 ATR 抢先，主升浪被过早切断，与回测行为严重不符。此前虽做了 `7×` 乘数的前端临时校准，但仍非精确解。

## What Changes
- Supabase `rps_style_point` 表新增 `target_high_qfq` 和 `target_low_qfq` 列（DBA 手动执行）
- `RpsStylePointRow` 类型新增 `target_high_qfq` / `target_low_qfq` 字段
- `RpsComputedPoint` 类型新增 `targetHighQfq` / `targetLowQfq` 字段
- `refreshRpsStyleSnapshots.ts` 获取 QFQ 日线时透传 high/low，写入 Supabase
- `RpsStyleSeriesPoint` 前端 API 类型新增 `targetHighQfq` / `targetLowQfq`
- `rpsStyle.ts` API 层将 high/low 透传到前端
- 前端 `PreparedPoint` 和 `PreparedMomentumPoint` 新增 `targetHighQfq` / `targetLowQfq`，ATR 改用真实 True Range 计算
- `buildV61MarkerDetails` 和 `buildBaselineEnhancedEvents` 中 ATR 乘数恢复为 `3`
- 前端 `ATR_FRONTEND_MULTIPLIER = 7` 临时补丁移除
- **BREAKING**: Supabase `rps_style_point` 表结构变更需 DBA 操作；`refreshRpsStyleSnapshots` 需全量回填一次

## Impact
- Affected specs: `add-baseline-enhanced-risk-strategy`, `unify-top200-and-momentum-analysis-signal-source`
- Affected code:
  - `server/lib/supabaseRest.ts` — `RpsStylePointRow` 类型及写入函数
  - `server/lib/rpsStyle.ts` — `RpsComputedPoint` 类型、`fetchQfqDailyWithFallback`、API 输出
  - `server/scripts/refreshRpsStyleSnapshots.ts` — 数据写入透传 OHLC
  - `src/utils/marketApi.ts` — `RpsStyleSeriesPoint` 类型
  - `src/components/charts/RpsCustomQueryCharts.tsx` — `PreparedPoint`、ATR 计算、V6.1 标记
  - `src/utils/momentumSignalSnapshot.ts` — `PreparedMomentumPoint`、ATR 计算、V6.1 事件
  - `src/utils/baselineEnhancedMethodology.ts` — 移除校准说明
  - Supabase `rps_style_point` 表 — 新增两列 + 全量回填

## ADDED Requirements

### Requirement: RPS 管道透传 QFQ 前复权 High/Low
系统 SHALL 在 RPS 数据管道中增加 `target_high_qfq` 和 `target_low_qfq` 字段，从前端到后端全链路透传，供 ATR 真实波幅计算使用。

#### Scenario: 后端数据获取
- **WHEN** `refreshRpsStyleSnapshots` 刷新各 ETF 的 RPS 数据
- **THEN** 从东方财富 QFQ K 线 API（`fqt=1, fields2=f51,f52,f53,f54,f55`）同时获取 high/low
- **THEN** 将 `target_high_qfq` / `target_low_qfq` 写入 Supabase `rps_style_point` 表

#### Scenario: API 透传到前端
- **WHEN** 前端通过 `/api/rps/custom-query` 获取价格序列
- **THEN** `RpsStyleSeriesPoint` 包含 `targetHighQfq: number` 和 `targetLowQfq: number`
- **THEN** 数据来源为 Supabase 写入的 `target_high_qfq` / `target_low_qfq`

#### Scenario: ETF200 信号快照也使用 OHLC
- **WHEN** `computeMomentumSignalSnapshot` 计算 ETF200 的信号快照
- **THEN** `PreparedMomentumPoint` 包含 high/low 字段
- **THEN** ATR(14) 基于真实 True Range 计算（与动量分析图表完全一致）

### Requirement: ATR 计算从近似改为真实 True Range
系统 SHALL 将前端和信号快照中的 ATR(14) 计算从收盘价近似改为真实 True Range 公式。

#### Scenario: True Range 公式
- **WHEN** 前端计算 ATR(14)
- **THEN** 每个交易日的 True Range = `max(high[i]-low[i], |high[i]-close[i-1]|, |low[i]-close[i-1]|)`
- **THEN** ATR(14) = True Range 的 14 日 SMA

#### Scenario: ATR 乘数恢复正常
- **WHEN** ATR-3x 止损判断
- **THEN** 阈值 = `highestClose - 3 × ATR(14)`（恢复为回测中的 3，而非临时补丁 7）
- **THEN** `ATR_FRONTEND_MULTIPLIER = 7` 常量移除

#### Scenario: 动量分析与 ETF200 计算结果一致
- **WHEN** 同一 ETF 在「动量分析」图表和「ETF200列表」中均使用 Baseline加强风控策略
- **THEN** 两个位置的交易信号（买/卖/风控卖）基于完全相同的数据和方法计算
- **THEN** 信号日期、类型完全一致

### Requirement: 数据库表结构变更
系统 SHALL 对 Supabase `rps_style_point` 表增加两列并全量回填一次。

#### Scenario: DDL
- **WHEN** DBA 执行 DDL
- **THEN** `ALTER TABLE rps_style_point ADD COLUMN target_high_qfq numeric, ADD COLUMN target_low_qfq numeric`
- **THEN** 两列允许 NULL（历史数据回填前为 NULL）

#### Scenario: 全量回填
- **WHEN** `refreshRpsStyleSnapshots` 下次运行时
- **THEN** 对全量 ETF 从 2016-01-01 起重新获取 QFQ 数据并写入含 high/low 的新字段
- **THEN** 回填完成后所有有效行 `target_high_qfq` / `target_low_qfq` 均非 NULL

## MODIFIED Requirements

### Requirement: ATR 校准说明从方法论中移除
**Reason**: 管道增强后前端使用真实 True Range，不再需要临时校准
**Migration**: `baselineEnhancedMethodology.ts` 中关于 `7×` 校准的描述替换为真实 ATR(14) 定义，说明基于 OHLC 的 True Range

### Requirement: PreparedPoint 增加 high/low 字段
**Reason**: 替代原有纯基于 close 的 ATR 近似
**Migration**: `PreparedPoint` 和 `PreparedMomentumPoint` 新增 `targetHighQfq: number` / `targetLowQfq: number`，ATR 计算代码重写
