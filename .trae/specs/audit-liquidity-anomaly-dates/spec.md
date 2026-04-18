# 大盘看板：流动性指数异常日期归因 Spec

## Why
用户反馈流动性指数在 `2024-12-18` 与 `2025-03-10` 出现明显异常。只读排查显示：当前代码按全历史窗口（`2016-01-01..2025-03-31`）重算后，这两个日期并不复现截图中的极端值；当前重算结果分别约为：
- `2024-12-18`: `amountPct=93.25`、`trPct=95.48`、`northPct=93.18`、`v5=93.97`、`v5Pct=83.49`、`equityBondPct=76.98`
- `2025-03-10`: `amountPct=93.41`、`trPct=92.10`、`northPct=94.58`、`v5=93.36`、`v5Pct=80.24`、`equityBondPct=75.40`

这与截图中 `2024-12-18` 的 `v5=20.6 / v5Pct=5.9 / equityBondPct=77.0` 明显不一致。进一步直接取源后发现：
- `Eastmoney` 在这两天返回的 `amount + tr` 正常；
- `northMoney` 在这两天也正常，并不支持截图中的极端低 `v5`；
- `Baostock` 在这两天返回了异常的 `tr=0`（至少 `sh_tr/sz_tr` 为 0）。

因此，当前最有证据支持的结论不是 `northbound` 异常，而是“旧发布 run 使用的 turnover 分支在这两个日期把 `tr / trPct` 打穿”，从而把 `v5 / v5Pct` 一起压塌。按当前数据反推，若 `amountPct` 与 `northPct` 仍在高位，而 `trPct` 接近 `1`，则 `v5` 会落到截图中的 20 左右，和现象一致。

## What Changes
- 增加对指定异常日期的“发布值 vs 当前重算值”对账能力，明确异常发生在已发布 run、缓存快照还是当前处理链路。
- 对 `2024-12-18` 与 `2025-03-10` 的 `amount / tr / northMoney / amountPct / trPct / northPct / v5 / v5Pct / equityBondPct` 做逐项归因，输出差异报告。
- 将最小守卫方案聚焦到 `tr / trPct`：把 `tr` 主源固定为 `Eastmoney`，`Baostock` 不再作为流动性指数换手率的可信主源。
- 为 `tr` 增加脏值守卫：`tr<=0`、异常低值、跨源冲突（如 `Baostock=0` 而 `Eastmoney` 正常）时，直接标记为无效或阻止发布。
- 为流动性指数增加“异常点发布守卫”：当 `amountPct` 与 `northPct` 正常，但 `trPct` 单日极端塌陷并导致 `v5 / v5Pct` 异常下刺时，阻止发布新 run。
- 增加最小冒烟测试：对 `2024-12-18` 与 `2025-03-10` 做指定日期重算，验证 `v5 / v5Pct` 不再因错误 `tr` 值塌陷。
- 保持实现简单：不改前端展示结构；优先补诊断、数据核查与发布前守卫。

## Impact
- Affected specs:
  - `harden-market-board-turnover-provider-fallback`
  - `harden-market-board-github-runner-failover`
  - `enforce-market-board-nightly-full-backfill`
- Affected code:
  - `server/lib/liquidityV5.ts`
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/lib/hkex.ts`
  - `server/scripts/refreshMarketBoardPoints.ts`
  - `server/lib/supabaseRest.ts`
  - `server/scripts/*market*`

## ADDED Requirements
### Requirement: 指定异常日期必须能逐项归因
系统 SHALL 对用户指定的异常日期输出流动性指数各个原始字段与派生字段的完整对账结果，而不是只给出最终 `v5` 或 `v5Pct`。

#### Scenario: 排查 2024-12-18 与 2025-03-10
- **GIVEN** 用户指定 `2024-12-18` 与 `2025-03-10`
- **WHEN** 系统执行异常排查
- **THEN** 输出这两个日期的 `amount / tr / northMoney / amountPct / trPct / northPct / v5 / v5Pct / equityBondPct`
- **AND** 同时输出前后若干交易日的对比值，便于判断是单日断点还是连续趋势

### Requirement: 发布值与当前重算值必须可对账
系统 SHALL 能区分“当前代码重算结果正常”与“旧发布 run 数据异常”这两类情况，并明确差异来源。

#### Scenario: 当前重算不复现截图异常
- **GIVEN** 当前代码全历史重算后，异常日期不复现极端低值
- **WHEN** 系统进行对账
- **THEN** 系统标记该异常更可能存在于已发布 run、缓存快照或旧处理逻辑
- **AND** 不把问题误判为当前公式本身必然异常

### Requirement: 流动性异常归因优先核查 tr / trPct 分支
系统 SHALL 把 `tr / trPct` 作为优先核查对象，因为已直接取源确认这两个异常日期上 `Eastmoney` 的 `tr` 正常，而 `Baostock` 的 `tr` 出现了 0 值异常。

#### Scenario: v5 单日塌陷但 amountPct 与 northPct 正常
- **GIVEN** 单日 `v5` 或 `v5Pct` 明显低于前后交易日
- **AND** `amountPct` 与 `northPct` 仍处于高位
- **WHEN** 系统做根因分析
- **THEN** 优先核查 `tr` 原始值、`trPct` 分位、源切换逻辑与 0 值/异常低值处理

### Requirement: tr 字段必须采用稳定主源并对脏值加守卫
系统 SHALL 将流动性指数中的 `tr` 主源固定为稳定来源，并对可疑的 0 值或异常低值做过滤或拦截。

#### Scenario: Baostock 返回 0 换手率而 Eastmoney 正常
- **GIVEN** 某日期 `Baostock.tr=0`
- **AND** 同日期 `Eastmoney.tr` 为正常正值
- **WHEN** 系统构建流动性序列
- **THEN** 系统不得将该 `Baostock.tr=0` 直接用于 `trPct`
- **AND** 日志明确标记为 `tr dirty value` 或跨源冲突
- **AND** 必要时阻止发布新 run

### Requirement: 发布前必须拦截不合理的单日流动性塌陷
系统 SHALL 在发布新 run 前校验流动性指数是否出现“原始字段无法解释的单日极端断点”，并在命中时阻止发布。

#### Scenario: v5Pct 单日跌到极低但 tr 以外字段未同步下滑
- **GIVEN** 某日 `v5Pct` 相比邻近日出现极端下跌
- **AND** `amountPct / northPct` 未出现对应级别的下跌
- **AND** `trPct` 出现单日极端塌陷或 `tr` 原始值为 0/异常低值
- **WHEN** 系统准备发布新 run
- **THEN** 系统将该 run 判定为异常
- **AND** 阻止切换可见 run

### Requirement: 异常日期必须纳入最小冒烟测试
系统 SHALL 将 `2024-12-18` 与 `2025-03-10` 纳入最小冒烟测试，用于验证流动性指数不会再因错误 `tr` 值而异常塌陷。

#### Scenario: 运行指定日期冒烟
- **GIVEN** 系统执行流动性指数冒烟测试
- **WHEN** 覆盖 `2024-12-18` 与 `2025-03-10`
- **THEN** 输出这两个日期的 `amount / tr / northMoney / amountPct / trPct / northPct / v5 / v5Pct`
- **AND** 验证 `v5 / v5Pct` 不再复现截图中的异常塌陷

## MODIFIED Requirements
### Requirement: 流动性指数稳定性验证
系统 SHALL 不仅验证 backfill 能跑通，还要验证关键日期的流动性数值在“发布值 vs 当前重算值”之间保持可解释一致性，并通过指定日期冒烟测试覆盖已知异常日。

### Requirement: 大盘看板发布前校验
系统 SHALL 将“关键日期异常点归因”和“`tr / trPct` 脏值守卫”纳入发布前校验范围；若发现已知异常日期仍存在不可解释偏差，发布应失败。

## REMOVED Requirements
N/A
