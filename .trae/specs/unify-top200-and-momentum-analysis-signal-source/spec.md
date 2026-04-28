# 统一ETF200与动量分析信号口径 Spec

## Why
当前 ETF200 列表快照与动量分析页会在少数 ETF 上出现最近交易信号日期不一致的问题，根因是两条链路依赖的基准序列与裁剪口径不完全一致。需要实施 C 方案，把列表快照、动量分析查询和图表信号统一到同一套稳定数据源与同一套截止日规则，彻底消除环境漂移。

## What Changes
- 为 ETF200 快照脚本和动量分析查询链路提供统一的信号序列构建入口
- 将 `H30269` 基准从运行时实时抓取切换为稳定发布序列，保证 GitHub Runner、本地与页面复算结果可重复
- 统一 ETF200 列表与动量分析页的 `referenceDate/endDate` 裁剪规则，只按最近完整交易日计算当前信号
- 为信号生成过程补充最小调试与校验能力，便于定位单只 ETF 的序列差异
- 补充针对 `513690` 及其他 0 轴敏感 ETF 的严格回归验证

## Impact
- Affected specs: `add-top200-momentum-signal-snapshot-columns`, `add-market-rps-custom-query`, `replace-market-rps-benchmark-with-h30269-total-return`, `add-momentum-analysis-buy-sell-markers`
- Affected code: `server/lib/rpsStyle.ts`, `server/lib/lowVol.ts`, `server/scripts/refreshTop100Snapshot.ts`, `server/scripts/publishTop100ToSupabase.ts`, `server/routes/rpsStyle.ts`, `src/utils/momentumSignalSnapshot.ts`, `src/pages/Home.tsx`, `src/components/charts/RpsCustomQueryCharts.tsx`

## ADDED Requirements
### Requirement: 统一信号输入序列
系统 SHALL 为 ETF200 列表快照与动量分析页提供同一套信号输入序列构建能力，保证同一 ETF、同一策略、同一完整交易日下得到一致的最近交易信号与新鲜度。

#### Scenario: 同日同策略结果一致
- **WHEN** ETF200 列表与动量分析页针对同一 ETF、同一策略并以同一最近完整交易日为基准计算信号
- **THEN** 两者产出的 `signalKey`、`signalDate`、`signalLabel` 与 `freshnessBucket` 必须一致

#### Scenario: 统一截止日裁剪
- **WHEN** 系统为某只 ETF 计算当前信号快照
- **THEN** 必须仅使用不晚于该 ETF 最近完整交易日的价格与基准序列
- **AND** 不得因运行时抓到更晚的盘中或异步更新数据而改变结果

### Requirement: 稳定基准序列优先
系统 SHALL 使用稳定发布的 `H30269` 序列作为动量分析与 ETF200 信号计算的统一基准，避免因实时源差异导致 `Score` 在 0 轴附近漂移。

#### Scenario: GitHub Runner 与本地重复运行
- **WHEN** 在不同环境中针对同一 ETF 和同一截止日重复运行信号计算
- **THEN** 只要稳定发布的基准 run 未变化，结果应保持一致

#### Scenario: 稳定基准缺失
- **WHEN** 指定截止日所需的稳定基准序列不可用
- **THEN** 系统不得静默切回另一套实时基准口径继续发布
- **AND** 必须按既有发布规则中止发布或返回明确的降级状态

### Requirement: 单ETF调试可观测
系统 SHALL 提供最小调试能力，用于输出指定 ETF 在信号生成时实际使用的截止日、序列尾部与最终快照结果，便于核对环境差异。

#### Scenario: 指定调试 ticker
- **WHEN** 运维在脚本或服务端启用指定 ticker 的调试开关
- **THEN** 日志中应输出该 ticker 的 `referenceDate`、最近若干序列点及多策略快照结果
- **AND** 未开启调试时不得污染常规日志

## MODIFIED Requirements
### Requirement: ETF200 信号快照发布
ETF200 列表快照的交易信号计算 SHALL 继续由 GitHub 日任务执行并写入 Supabase，但信号输入序列必须与动量分析页共享同一套稳定基准和截止日规则，而不是单独依赖运行时实时基准数据。

#### Scenario: 列表快照发布后与页面一致
- **WHEN** GitHub 日任务完成并发布新的 ETF200 快照
- **THEN** 列表页显示的信号与进入动量分析页后看到的同策略当前信号必须一致

### Requirement: 动量分析自定义查询
动量分析页的自定义查询 SHALL 与 ETF200 快照共用统一的基准序列和信号裁剪规则，确保图上信号箭头、摘要和列表快照口径一致。

#### Scenario: 0轴敏感ETF不再漂移
- **WHEN** 用户查询像 `513690` 这类 `Score` 接近 0 轴的 ETF
- **THEN** 图表上的最新有效买卖点日期与 ETF200 列表快照应保持一致
- **AND** 不应因环境、请求时机或基准源细微差异而从 `4/13` 漂移到 `4/24`

## REMOVED Requirements
### Requirement: ETF200 与动量分析可分别使用不同基准输入
**Reason**: 该做法会导致列表快照与图表信号在边界样本上出现不可解释的日期漂移。
**Migration**: 统一迁移到共享信号序列构建入口，并仅以稳定发布的 `H30269` 基准 run 作为主口径。
