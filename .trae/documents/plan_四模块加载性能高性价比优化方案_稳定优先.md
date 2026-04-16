# 四模块加载性能高性价比优化方案（稳定优先）

## Summary
- 目标：在不改变“默认全量历史”展示策略下，显著降低低波机会、价值择时、大盘看板、RPS 模块的等待时间与后端压力。
- 约束：稳定性优先；开发量小；不重构数据口径、不改 nightly 发布链路、不改 run 原子发布与回退机制。
- 用户偏好（已确认）：采用较长缓存；前端默认全量历史不变。
- 方案主线：`传输压缩` + `读路径缓存` + `前端会话复用` + `Summary 轻量化`，优先做不改接口或仅增量接口的改造。

## Current State Analysis

### 1) 路由层全部 no-store，导致每次强制回源
- 现状文件：
  - `server/routes/lowVol.ts`
  - `server/routes/value.ts`
  - `server/routes/market.ts`
  - `server/routes/rpsStyle.ts`
- 现状：四模块接口均设置 `Cache-Control: no-store`，浏览器与中间层都无法复用。
- 影响：切换 tab、来回切指数、短时间重复打开页面时，都会重复打满后端与 Supabase 读取链路。

### 2) 返回 payload 体量大且未启用压缩
- 现状文件：`server/app.ts`
- 现状：Express 未启用响应压缩，中长时间序列 JSON（全量历史）网络传输耗时高。
- 影响：尤其在移动端/网络波动场景，TTFB 后下载阶段仍慢。

### 3) Summary 接口在服务端做了“全序列读取+循环”
- 现状文件：
  - `server/lib/lowVol.ts` 的 `getLowVolSummary()`
  - `server/lib/valueTiming.ts` 的 `getValueTimingSummary()`
- 现状：Summary 为拿“最新卡片值”，却按 code 循环读取较长区间序列并做校验，计算和 IO 冗余。
- 影响：进入 lowvol/value tab 的首轮卡片加载时间偏长，后端读取开销偏高。

### 4) 前端面板在切换后会重新请求，缺少会话级复用
- 现状文件：
  - `src/components/LowVolOpportunityPanel.tsx`
  - `src/components/ValueTimingPanel.tsx`
  - `src/components/MarketLiquidityPanel.tsx`
  - `src/components/RpsStylePanel.tsx`
  - `src/utils/marketApi.ts`
- 现状：组件挂载后立即请求，缺少统一的“短期内同参命中”缓存。
- 影响：同一会话内回切 tab 或切回已看过指数时，重复等待。

### 5) RPS 面板初始化请求数量偏多
- 现状文件：`src/components/RpsStylePanel.tsx`
- 现状：初始化包含 `summary + matrix + N个series`（N=标的数），虽有并发但总请求数多。
- 影响：弱网或高延迟情况下整体完成时间受最慢请求拖累明显。

## Proposed Changes

### P0（最高性价比，先做）

#### A. 启用全局响应压缩（不改业务逻辑）
- 文件：`server/app.ts`, `package.json`
- 做法：
  - 增加 `compression` 中间件，对 `/api/*` JSON 响应启用 gzip/br（按环境自动协商）。
  - 保持健康检查等小包响应无需特殊处理。
- Why：对“默认全量历史”场景最直接，改造小、收益稳定、风险低。

#### B. 路由缓存策略从 `no-store` 调整为“可控短中期缓存”
- 文件：
  - `server/routes/lowVol.ts`
  - `server/routes/value.ts`
  - `server/routes/market.ts`
  - `server/routes/rpsStyle.ts`
- 做法：
  - 统一改为 `Cache-Control: private, max-age=300, stale-while-revalidate=120`（5 分钟主缓存 + 2 分钟宽限）。
  - 对错误响应保持不缓存（仅成功响应设置上述 header）。
- Why：符合“较长缓存”偏好，且 `private` 与鉴权请求兼容，避免公共代理污染。

#### C. 增加服务端内存 TTL 缓存（结果级，按查询参数键控）
- 文件：
  - `server/lib/marketBoardSupabaseService.ts`
  - `server/lib/lowVol.ts`
  - `server/lib/valueTiming.ts`
  - `server/lib/rpsStyle.ts`
- 做法：
  - 对高频读函数增加统一的轻量 Map 缓存（TTL=5 分钟，单飞 inflight 去重）。
  - 缓存键包含：模块、code/ticker、startDate、endDate、关键模式参数。
  - 命中直接返回，未命中回源后写入；异常结果不入缓存。
- Why：即使浏览器端失效/刷新，也能显著降低重复回源与 Supabase 分页读取。

#### D. 前端 API 层会话缓存（同参命中即复用）
- 文件：`src/utils/marketApi.ts`
- 做法：
  - 在 `fetchLowVolIndex / fetchValueTimingIndex / fetchMarketLiquidityV5 / fetchRpsStyleSeries / fetchRpsStyleMatrix / fetchRpsStyleSummary` 增加前端内存缓存（TTL=5 分钟）。
  - 缓存 key 包含 URL + 参数；对 AbortError 或失败响应不缓存。
  - 保持函数签名不变，组件层改动最小。
- Why：切 tab 回来几乎秒开，开发量小，且不会改变页面行为。

### P1（次优先，低风险增益）

#### E. Summary 轻量化：仅取“每个 code 最新有效点”，不扫全量序列
- 文件：
  - `server/lib/supabaseRest.ts`
  - `server/lib/lowVol.ts`
  - `server/lib/valueTiming.ts`
- 做法：
  - 在 `supabaseRest` 新增 `readLowVolLatestPointsByCodes()`、`readValueTimingLatestPointsByCodes()`。
  - 查询策略：优先 `current_run_id`，按 `code + data_date desc limit 1` 拉取；失败时再回退 `historyRunIds`。
  - `getLowVolSummary()` 与 `getValueTimingSummary()` 改为基于该轻量读取拼装结果。
- Why：Summary 是首页/卡片入口，改完后低波与价值 tab 首屏显著加速。

#### F. RPS 初始化降请求（保持接口兼容，新增聚合接口）
- 文件：
  - `server/routes/rpsStyle.ts`
  - `server/lib/rpsStyle.ts`
  - `src/utils/marketApi.ts`
  - `src/components/RpsStylePanel.tsx`
- 做法：
  - 新增 `GET /api/rps/panel`，一次返回 `summary + matrix + seriesByTicker`。
  - `RpsStylePanel` 初始化改为单请求；原接口保留，作为回退。
- Why：显著降低请求总数和排队抖动，对 RPS 初次加载改善明显。

## Assumptions & Decisions
- 决策：遵循“默认全量历史”不变，不通过缩短默认时间窗换速度。
- 决策：缓存优先采用 5 分钟 TTL（服务端与前端一致），满足“较长缓存”偏好。
- 决策：不改 Supabase 表结构与 run 发布协议，仅优化读取与传输路径。
- 决策：所有缓存仅作用于读取接口，写入脚本与发布流程不受影响。
- 假设：当前数据更新频率以日更为主，5 分钟缓存不会影响业务判读。

## Verification Steps

### 功能正确性
- 低波/价值/大盘/RPS 模块在首次进入、重复进入、切换标的后数据一致（与改造前对比抽样日期与最新值）。
- 回退 run 场景下，接口仍按既有规则返回可用 run，不卡死在缓存脏数据。

### 性能验收（本地与预发）
- 指标采集：
  - 浏览器 Network：`TTFB`、`Content Download`、`Transferred`、请求数。
  - 服务端日志：缓存命中率、Supabase 查询次数、响应耗时 p50/p90。
- 验收门槛（目标）：
  - 四模块“二次进入同参数”耗时下降 ≥ 60%。
  - RPS 首次完整可视化耗时下降 ≥ 30%。
  - 响应体传输字节下降（压缩后）≥ 50%（按典型全量序列接口）。

### 稳定性验收
- 断网/超时/上游失败时，错误展示与现有行为一致，不出现空白页或卡死 loading。
- 缓存过期与并发请求下不出现数据错配（code/ticker 串数据）。
- 夜间发布窗口后，缓存最多在 TTL 内收敛到新数据（符合既定预期）。

## 实施顺序（建议）
1. P0-A 压缩 + P0-B 路由缓存头（最小改动，立即见效）
2. P0-C 服务端 TTL 缓存 + P0-D 前端会话缓存（进一步减少重复回源）
3. P1-E Summary 轻量化（优化 lowvol/value 首屏）
4. P1-F RPS 聚合接口（针对 RPS 再做一轮提速）

## Out Of Scope
- 不调整指标公式、滚动窗口口径、run 发布策略、回退策略。
- 不引入 Redis 等外部缓存基础设施（先以进程内缓存拿低成本收益）。
- 不改默认展示为近3年/5年（按已确认偏好保持全量）。
