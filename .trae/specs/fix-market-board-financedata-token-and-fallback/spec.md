# 大盘看板：FinanceData token 失效与多源回退修复 Spec

## Why
GitHub Actions 回灌“市场大盘”模块时，主源 financeData 返回“token 不对”，替代源 AkShare/Eastmoney 同时失败，导致分段计算 20160101..20171231 全部重试后仍报错并中止。本次需识别并绕过无效主源、完善沪深300点位 close 的多级回退、以及为 Runner 环境提供更稳健的默认数据源策略。

## What Changes
- 新增“主源失效识别与跳过”：当 financeData 返回明确的认证错误（含 code/msg），自动停用本次回灌对 financeData 的调用，进入替代源链路；不再重复对同分段进行 financeData 重试。
- 强化沪深300 close 的多级回退链路：Eastmoney → AkShare → csindex/cnindex（仅补 close，不改变其它字段口径），并对空数据与样本量不足进行校验。
- 调整 GitHub Actions 默认数据源策略：回灌 backfill 默认采用“hybrid（Eastmoney-first）”，仅在显式配置时使用 financeData；日志输出生效策略与回退层级。
- 增加预探测（probe）：在分段计算前快速检测 financeData token 有效性与 Eastmoney 可用性，提前决定链路与重试预算。
- 保持“失败不切换可见 run”的原子发布策略，并将分段失败原因与数据源选择写入 meta.notes。

## Impact
- Affected specs:
  - enforce-market-board-nightly-full-backfill（提高成功率与链路可观测性）
  - stabilize-market-board-github-data-sources（补充 token 识别与默认策略修订）
- Affected code:
  - server/lib/marketLiquidityV5Service.ts（数据源选择、token 错误识别、备用 close 回退）
  - server/lib/lowVol.ts（复用 csindex/cnindex 指数点位抓取）
  - server/scripts/refreshMarketBoardPoints.ts（probe 与分段日志、失败不切换保障）
  - .github/workflows/refresh-market-board.yml（默认数据源改为 hybrid，并支持覆盖）

## ADDED Requirements
### Requirement: 主源 token 失效自动跳过
系统 SHALL 在 financeData 返回认证错误（如“token 不对”）时，标记主源本次不可用并跳过后续同分段对该源的重试，直接进入替代源链路。

#### Scenario: token 失效
- WHEN financeData 响应包含错误 code 与“token 不对”提示
- THEN 分段内不再调用 financeData
- AND 进入 Eastmoney/AkShare/csindex 回退链路
- AND 在日志与 meta.notes 记录“主源失效已跳过”

### Requirement: 沪深300 close 多级回退
系统 SHALL 在无法获取沪深300日线时，按 Eastmoney → AkShare → csindex/cnindex 的顺序回退，仅补 close，校验最小样本量与非空。

#### Scenario: 主替代源均失败
- GIVEN Eastmoney 与 AkShare 均返回失败或空数组
- WHEN 需要生成沪深300 close
- THEN 使用 csindex/cnindex 抓取 close 并通过样本量校验
- AND 若仍失败，则判定分段失败并终止当前 run 切换

### Requirement: GitHub 默认数据源策略修订
系统 SHALL 将回灌 backfill 的默认 `MARKET_DATA_SOURCE` 设置为“hybrid（Eastmoney-first）”，允许通过 workflow input/env 覆盖，并在日志输出实际生效策略。

### Requirement: 预探测与日志
系统 SHALL 在分段计算前进行快速 probe（financeData token 与 Eastmoney连通性），并在每个分段输出：生效数据源、是否触发回退、最终样本量与失败原因。

## MODIFIED Requirements
### Requirement: 原子发布失败不切换
系统 SHALL 继续在任一分段失败时不更新 `market_board_meta.current_run_id`，并保留最近5个 run 以快速回退；meta.notes 需包含失败分段与数据源选择。

## REMOVED Requirements
N/A

