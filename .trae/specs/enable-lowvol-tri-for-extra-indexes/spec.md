# 低波机会：补齐 932365/932315 的 TRI 数据 Spec

## Why
当前低波机会已支持三只指数切换，但 932365、932315 缺少全收益指数（TRI）序列，导致股息率、核心利差、利差分位等关键指标为空，无法用于同口径的性价比判断。

## What Changes
- 为 932365（中证全指自由现金流）与 932315（中证全指红利质量）补齐价格指数（PRI）与全收益指数（TRI）的 code 映射。
- 服务端在计算股息率/核心利差/利差分位时，对这两只指数与 H30269 使用同一套口径（PRI/TRI 推算 + 分红点数平滑 + 与 10Y 做利差 + 分位）。
- 在 TRI 缺失或拉取失败时，API 返回明确错误（而不是静默返回 null 指标），以便前端进入错误态。

## Impact
- Affected specs: 低波机会的核心指标（股息率/核心利差/利差分位）在 932365、932315 上由“空”变为“可用”
- Affected code:
  - `server/lib/lowVol.ts`：指数配置、TRI 拉取与指标计算
  - `server/routes/lowVol.ts`：按 code 获取序列接口返回行为（错误处理）
  - （可选）`server/scripts/*`：用于验证的脚本

## ADDED Requirements
### Requirement: TRI 映射补齐
系统 SHALL 为以下指数提供 PRI 与 TRI 的 code 映射：
- 932365：中证全指自由现金流指数
- 932315：中证全指红利质量指数

#### Scenario: 指标可用
- **WHEN** 请求 `GET /api/lowvol/index/932365` 或 `GET /api/lowvol/index/932315`
- **THEN** 响应的 `data.series` 中 `dividendYieldPct/spreadRawPct/spreadSmoothPct/spreadPct/spreadPctRank3y/spreadPctRank10y` 不再整体为空（在满足必要回溯窗口后应逐步出现有效数值）

### Requirement: 失败时显式报错
系统 SHALL 在 TRI 序列无法获取或无法对齐到足够样本时返回错误，而非静默返回空指标。

#### Scenario: TRI 不可用
- **WHEN** TRI 拉取失败（网络/WAF/返回非预期格式/数据为空等）
- **THEN** API 返回 502（或 500），并提供可读 `message`，提示“TRI 数据不可用，无法计算股息率/利差”

## MODIFIED Requirements
### Requirement: meta.notes 口径说明
系统 SHALL 在 `meta.notes` 中明确记录每只指数的 priCode/triCode，以及股息率与核心利差口径。

## REMOVED Requirements
### Requirement: TRI 缺失时返回空指标
**Reason**: 空指标会误导用户认为“数据已就绪”，影响图表判断。
**Migration**: 前端依赖已有的 error 展示即可（DataStatusBanner）。

