# 大盘看板10Y数据源稳健性增强 Spec

## Why
GitHub Actions 回灌中，10Y 国债收益率（Chinamoney）存在连续超时重试，显著拉长任务时长并提高失败风险。  
需要最小修复以提升稳定性，并提供可用替代数据源，避免单点依赖。

## What Changes
- 为 10Y 拉取链路增加“主源失败后的替代源”机制，至少保证一个可用回退路径。
- 将 10Y 的探测与拉取策略改为“限时退避 + 快速降级”，避免长时间阻塞整次 backfill。
- 在日志与 `meta.notes` 中明确记录：主源是否失败、是否触发替代源、替代源名称与覆盖范围。
- 保持“失败不发布新 run”与“不写入推测值”原则不变。

## Impact
- Affected specs: 大盘看板夜间回灌稳定性、10Y 数据源容灾、发布链路可观测性
- Affected code: `chinamoneyGovBond` 拉取策略、`marketLiquidityV5Service` 10Y 组装逻辑、`refreshMarketBoardPoints` 探测与日志

## ADDED Requirements
### Requirement: 10Y 数据源必须具备替代源回退
系统 SHALL 在 Chinamoney 超时或失败时自动切换到替代数据源，并在同一轮计算中继续生成可校验结果。

#### Scenario: 主源超时
- **WHEN** Chinamoney 在限定重试预算内仍失败
- **THEN** 系统自动启用替代源获取 10Y，且不中断整次回灌流程

#### Scenario: 主源与替代源均失败
- **WHEN** 所有 10Y 数据源都不可用
- **THEN** 系统遵循既有发布保护，不切换可见 run，并输出可定位的失败原因

## MODIFIED Requirements
### Requirement: 回灌任务的稳定性优先策略
系统 SHALL 对 10Y 探测与拉取使用受控重试（有上限）与快速降级，避免单数据源长期阻塞；并将源切换信息写入日志与 `meta.notes`。

## REMOVED Requirements
### Requirement: 10Y 仅依赖单一主源长时间重试
**Reason**: 单点依赖与过长重试会放大任务波动，影响夜间任务稳定完成率。  
**Migration**: 保留主源优先，但引入替代源与受控重试预算；主源失败时自动降级，不改变发布保护规则。
