# 动量信号对齐：H30269 下游任务收口为 LowVol 下游 Spec

## Why
ETF200 列表、动量分析页、市场风格RPS总览页三者都依赖 H30269（红利低波全收益指数）作为 RPS 基准分母。`buildRpsComputedSeries`（[rpsStyle.ts:L834-L846](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/server/lib/rpsStyle.ts#L834-L846)）取 target ETF 价格与 H30269 收盘价的日期交集——若任何下游任务在 LowVol 发布当天数据之前运行，RPS 末尾日因缺少 H30269 被截断，信号与数据出现偏差。

当前三个工作流独立 cron 调度，竞态窗口存在：
- `refresh-rps-style-snapshots`：UTC 11:30–15:59（最早，LowVol 启动前 30 分钟）
- `refresh-lowvol-snapshots`：UTC 12:00–13:59
- `refresh-top100`：UTC 14:00 / 15:59

**解决思路：** LowVol 是唯一 H30269 数据生产者，Top200 与 RPS Style Snapshots 都是其强依赖下游。将三者收口为统一链路：LowVol 完成 → 自动触发 Top200 和 RPS Style Snapshots，消除独立 cron，杜绝竞态。

## What Changes
- **BREAKING** `refresh-top100.yml`：移除 `schedule`，仅保留 `workflow_run`（由 LowVol 成功后触发）和 `workflow_dispatch`
- **BREAKING** `refresh-rps-style-snapshots.yml`：移除 `schedule`，仅保留 `workflow_run`（由 LowVol 成功后触发）和 `workflow_dispatch`
- `refresh-lowvol-snapshots.yml`：cron 窗口扩展至 `0,15,30,45 12-14 * * *`（UTC），最后一场 UTC 14:00
- 前端 Home 页面移除「重新获取」按钮（[Home.tsx:L842-L850](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/src/pages/Home.tsx#L842-L850)）及关联逻辑
- 后端 `POST /api/admin/refresh` 路由移除
- `refreshTop100Snapshot.ts` 增加 H30269 防御性校验
- `refreshRpsStyleSnapshots.ts` 增加 H30269 防御性校验

## Impact
- Affected specs: add-top200-momentum-signal-snapshot-columns, add-market-rps-custom-query, split-market-rps-overview-and-custom-query-pages
- Affected code: `.github/workflows/refresh-top100.yml`、`.github/workflows/refresh-lowvol-snapshots.yml`、`.github/workflows/refresh-rps-style-snapshots.yml`、`src/pages/Home.tsx`、`server/routes/admin.ts`、`server/scripts/refreshTop100Snapshot.ts`、`server/scripts/refreshRpsStyleSnapshots.ts`

## ADDED Requirements
### Requirement: Top200 与 RPS Style Snapshots 均在 LowVol 成功后触发
系统 SHALL 移除 `refresh-top100` 和 `refresh-rps-style-snapshots` 工作流的 `schedule` 触发，仅通过 `workflow_run`（由 `Refresh LowVol Snapshots` 成功完成时触发）自动启动，并保留 `workflow_dispatch` 作为紧急手动入口。两个下游工作流在 LowVol 成功后并行运行。

#### Scenario: LowVol 完成后并行触发两个下游
- **GIVEN** `refresh-lowvol-snapshots` 工作流完成且 H30269 已包含最新交易日数据
- **WHEN** 工作流状态为 `completed` 且 `conclusion == 'success'`
- **THEN** `refresh-top100` 和 `refresh-rps-style-snapshots` 自动并行启动
- **AND** ETF200 列表、动量分析页、市场风格RPS总览页的 RPS 数据均使用同一份 H30269 基准

#### Scenario: 任一工作流 workflow_dispatch 仍可用
- **GIVEN** 用户通过 GitHub Actions UI 手动触发 `workflow_dispatch`
- **WHEN** 工作流运行
- **THEN** 仍正常执行对应刷新逻辑（保留作为紧急回退）

### Requirement: 前端移除 Top200 手动触发入口
系统 SHALL 从 Home 页面移除「重新获取」按钮及其关联的 `onRefetch` 逻辑、`adminRefreshing`/`adminNotice` 状态、`POST /api/admin/refresh` 调用链路。

### Requirement: 后端 `/api/admin/refresh` 废弃
系统 SHALL 移除 `server/routes/admin.ts` 中的 `POST /refresh` 路由。

### Requirement: LowVol cron 窗口覆盖
系统 SHALL 将 `refresh-lowvol-snapshots` 的 cron 扩展为 `0,15,30,45 12-14 * * *`（UTC），最后一场在 UTC 14:00（北京 22:00）。

### Requirement: 下游脚本 H30269 防御性校验
系统 SHALL 在 `refreshTop100Snapshot.ts` 和 `refreshRpsStyleSnapshots.ts` 中，开始计算前校验 H30269（通过 `getLowVolIndexSnapshotSeries`）最新日期 ≥ 目标截止日期。不满足时静默跳过——不写数据、不报错、exit 0——因为下游工作流会在下次 LowVol 完成后再次自动触发。

校验逻辑仅在 H30269 **落后于**下游需要的截止日期时跳过，**不跳过** H30269 领先于截止日期的正常情况（ETF 数据源更新滞后是合法场景）。

#### Scenario: H30269 领先于 ETF 参考日期 —— 放行
- **GIVEN** LowVol 已发布 2026-04-29 的 H30269 数据，但 ETF 列表中多数 ETF 的 `latestTradingDate` 仍为 2026-04-28（AkShare 或其他数据源尚未更新）
- **WHEN** `refreshTop100Snapshot.ts` 执行 H30269 校验：H30269 最新日期 `2026-04-29` >= `max(latestTradingDate)` = `2026-04-28`
- **THEN** 校验通过，继续计算信号
- **AND** 各 ETF 按其各自的 `latestTradingDate` 计算 RPS（日期交集自动截断到各自的有效日期）

#### Scenario: H30269 落后于 ETF 参考日期 —— 静默跳过
- **GIVEN** 手动触发 Top200（`workflow_dispatch`），但 LowVol 尚未运行，H30269 最新日期为 2026-04-28，而 ETF 列表的 `latestTradingDate` 为 2026-04-29
- **WHEN** 校验比较：`2026-04-28` < `2026-04-29`
- **THEN** 不写数据、不报错、exit 0，日志记录 `H30269 基准数据滞后（H30269=2026-04-28 < ETF=2026-04-29），跳过本次运行`
- **AND** 工作流标记为成功（等待下次 LowVol 完成后自动触发）

#### Scenario: 部分 ETF 数据超前、部分滞后 —— 各自正确
- **GIVEN** H30269 有 2026-04-29，ETF 列表中有 100 只 ETF 的 `latestTradingDate` 为 2026-04-29、100 只为 2026-04-28
- **WHEN** `hydrateMomentumSignals` 执行
- **THEN** 校验取 `max = 2026-04-29`，H30269 `2026-04-29 >= 2026-04-29` → 通过
- **AND** `latestTradingDate=2026-04-29` 的 ETF 计算到 2026-04-29，`latestTradingDate=2026-04-28` 的 ETF 自动截断到 2026-04-28，各自信号正确

## MODIFIED Requirements
（无修改的现有需求）

## REMOVED Requirements
### Requirement: Top200 定时调度
**Reason**: Top200 改为 LowVol 下游，不再需要独立 cron
**Migration**: cron 已从 `refresh-top100.yml` 移除

### Requirement: RPS Style Snapshots 定时调度
**Reason**: RPS Style Snapshots 改为 LowVol 下游，不再需要独立 cron
**Migration**: cron 已从 `refresh-rps-style-snapshots.yml` 移除

### Requirement: 前端「重新获取」按钮
**Reason**: Top200 由 LowVol 自动触发，无需手动入口
**Migration**: 按钮及关联代码从 Home.tsx 移除
