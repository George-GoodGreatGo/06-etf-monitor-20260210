# 低波机会：summary/latest 接口 + SMA 切换不重拉 Spec

## Why
“低波机会”支持的指数增多后，二级导航（指数卡片）为了展示每个指数的建议，当前会并发请求多个“全量历史序列”接口，导致首屏变慢、失败率升高（上游限流/网络抖动时尤甚）。同时，切换 SMA250/SMA60 会触发再次拉取，进一步放大请求压力。

## What Changes
- 新增后端轻量接口：返回“各指数最新点所需字段”（summary/latest），用于二级导航建议计算与展示。
- 前端二级导航建议改为使用 summary/latest 数据源：
  - 首次进入“低波机会”时仅请求一次 summary
  - 切换 SMA250/SMA60 时不再重新请求后端，仅用已缓存的最新点字段在前端重新计算建议
- 不改动现有图表/指标口径与现有全量接口：`GET /api/lowvol/index/:code` 保持不变。

## Impact
- Affected specs: 低波机会加载策略、二级导航建议展示
- Affected code:
  - `server/routes/lowVol.ts`：新增 `GET /summary`
  - `server/lib/lowVol.ts`：提供 summary 计算/缓存；可能复用现有 `getLowVolIndexSeries`
  - `src/utils/marketApi.ts`：新增 `fetchLowVolSummary`
  - `src/pages/Home.tsx`：二级导航建议数据源改造；SMA 切换不重拉

## ADDED Requirements
### Requirement: Summary 接口
系统 SHALL 提供轻量接口用于返回低波支持指数的“最新点摘要”。

#### API: `GET /api/lowvol/summary`
- 响应 SHALL 包含：
  - `meta`：`fetchedAt`、`dataDate`（可为空）、`source`、`notes`（可选）
  - `data.items`：数组，每项包含：
    - `code`：指数 code（与前端二级导航一致）
    - `latest`：最新点字段（至少包含 `date`、`spreadPctRank10y`、`biasPct3y`、`biasPct3y60`；其余可按需要补充）

#### Scenario: 成功返回
- **WHEN** 前端请求 `GET /api/lowvol/summary`
- **THEN** 返回 `success=true` 且 `data.items.length > 0`

#### Scenario: 失败处理
- **WHEN** 任一指数在计算 latest 时发生不可恢复错误（例如 TRI 为空/对齐不足）
- **THEN** summary 接口 SHOULD 返回 `success=true`，并将该指数项标记为 `latest=null` 且提供 `error/message` 字段（避免“一支失败拖垮全部”）
- **AND** 对于整体不可用（例如上游全体失败），summary 接口 MAY 返回 `success=false` 并携带可读 `message`

### Requirement: 结果缓存与去重
系统 SHALL 对 summary 计算结果做缓存与并发去重，以平衡性能与稳定性。
- **缓存**：同一份 summary 在短 TTL（例如 1–5 分钟）内重复请求直接命中缓存
- **in-flight 去重**：当 summary 正在计算时，后续请求复用同一个计算任务（Promise），避免并发重复计算

## MODIFIED Requirements
### Requirement: 二级导航建议的加载策略
系统 SHALL 将二级导航建议的加载策略从“按指数并发拉取全量序列”改为“单次 summary 拉取最新点摘要”。

#### Scenario: 首次进入低波机会
- **WHEN** 用户切换到“低波机会”tab
- **THEN** 前端仅请求一次 summary
- **AND** 二级导航建议在 summary 返回后统一更新

#### Scenario: 切换 SMA 基准
- **WHEN** 用户切换 SMA250/SMA60
- **THEN** 前端 SHALL 不触发任何后端请求
- **AND** 二级导航建议使用本地缓存的 `biasPct3y`/`biasPct3y60` 与 `spreadPctRank10y` 重新计算并即时更新

## REMOVED Requirements
### Requirement: SMA 切换触发重拉
**Reason**: 该行为会放大请求量与失败率，且不必要（所需字段已在最新点摘要中）。
**Migration**: 改为前端本地重算建议；图表全量序列仍由选中指数的 `/api/lowvol/index/:code` 承载。

