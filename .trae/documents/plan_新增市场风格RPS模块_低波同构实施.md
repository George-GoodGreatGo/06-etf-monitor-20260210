# 计划：新增“市场风格RPS”模块（低波同构实现）

## 1. Summary
- 在现有 `/market?tab=...` 体系下新增 `tab=rps`，左侧导航增加“市场风格RPS”入口。
- 后端新增 RPS 专用计算与发布链路，复用“低波机会”已验证的 **run 原子发布 + 历史 run 回退 + 保留最近 5 次** 模式。
- 数据源采用“免费优先”方案：**Eastmoney 前复权日线（qfq）主源**，失败时尝试 AkShare 兜底；仍失败则前端读取上次可见 run，保证页面可用。
- 前端采用 `lightweight-charts` 绘制 RPS 与 MA50，并在页面明确展示指标计算公式、信号判定与仓位建议逻辑。

## 2. Current State Analysis
- 导航与市场子模块由 `src/components/SideNav.tsx`、`src/pages/Home.tsx` 的 `HomeTab` 驱动，当前已有 `list/insight/liquidity/lowvol/value`。
- “低波机会”完整链路已具备：  
  - 前端面板与图表：`src/components/LowVolOpportunityPanel.tsx`、`src/components/charts/LowVolOpportunityChart.tsx`。  
  - API 读取封装：`src/utils/marketApi.ts`。  
  - 路由与服务：`server/routes/lowVol.ts`、`server/lib/lowVol.ts`。  
  - 定时刷新：`server/scripts/refreshLowVolSnapshots.ts` + `.github/workflows/refresh-lowvol-snapshots.yml`。  
  - Supabase run 模型：`supabase/migrations/0011_lowvol_run_model.sql` 与 `server/lib/supabaseRest.ts` 的 `readLowVolMeta/upsertLowVolIndexPoints/publishLowVolRun`。
- `server/lib/eastmoneyKline.ts` 已支持 Eastmoney 日线并固定 `fqt=1`（前复权），适配本需求的复权约束。
- `server/lib/akshare.ts` + `server/python/akshare_service.py` 已具备 Python 子进程调用能力，可作为主源失败后的兜底抓取执行器。

## 3. Proposed Changes

### 3.1 数据模型（Supabase）
- 新增迁移：`supabase/migrations/0013_rps_run_model.sql`（编号按现有连续号递增）。
- 新建表 `public.rps_style_point`：按 run 保存逐日逐标的数据，主键 `(run_id, ticker, data_date)`。字段包括：
  - 价格字段：`target_close_qfq`、`benchmark_close_qfq`
  - 指标字段：`rps_raw`、`rps_ma50`、`score_pct`
  - 元信息：`fetched_at`、`source_type`、`source`、`notes`
- 新建表 `public.rps_style_meta`：`current_run_id/previous_run_id/history_run_ids/current_data_date/publish_status/quality_summary`。
- 新增 RPC：`publish_rps_run(...)`，语义对齐 `publish_lowvol_run`：原子切换当前 run，并清理非保留 run 数据。
- RLS 策略：匿名只读 `current_run_id + history_run_ids` 对应 run。

### 3.2 Supabase REST 访问层
- 修改 `server/lib/supabaseRest.ts`，新增 RPS 对应类型与函数：
  - `RpsStylePointRow`、`RpsStyleMetaRow`
  - `readRpsStyleMeta()`
  - `readRpsStylePointsRange({ ticker, startDate, endDate, runId? })`
  - `upsertRpsStylePoints(rows)`
  - `publishRpsStyleRun({ nextRunId, previousRunId, keepRunIds, currentDataDate, publishStatus, qualitySummary })`
- 分页读取方式沿用现有 `limit + offset` 模式，避免单次 REST 返回截断。

### 3.3 后端计算服务（RPS 逻辑）
- 新增 `server/lib/rpsStyle.ts`：
  - 固定标的池：
    - 分母（防守基准）：`515080.SH`
    - 分子（进攻观测）：`159915.SZ`、`588000.SH`、`513180.SH`、`510300.SH`
  - 数据抓取：
    - 主源：Eastmoney（`fqt=1`，2016-01-01 至今全量）
    - 兜底：AkShare（补充实现 `rps-qfq` 子命令，按 ticker 拉 qfq 日线）
    - 归一化字段：`date/close`
  - 计算：
    - `rps_raw = target_close_qfq / benchmark_close_qfq`
    - `rps_ma50 = SMA(rps_raw, 50)`
    - `score_pct = (rps_raw / rps_ma50 - 1) * 100`
  - 决策引擎：
    - 全部分子 `score_pct < 0` => `risk_off`，建议 0% 进攻仓位
    - 否则选 `score_pct` 最高标的 => `risk_on`，建议主攻 33%，其余底仓
  - 读取策略：优先当前 run；校验失败/陈旧时自动回退历史 run（同低波）。
  - 对外输出：
    - `getRpsStyleMatrix()`：最新横截面 + 排序 + 决策摘要
    - `getRpsStyleSeries({ ticker })`：单标的历史曲线（RPS/MA50/Score）
    - `getRpsStyleSummary()`：供导航卡片/概览使用

### 3.4 刷新脚本与自动化发布
- 新增 `server/scripts/refreshRpsStyleSnapshots.ts`：
  - 每次全量回填 2016-01-01 至今（不走增量）
  - 写入 `rps_style_point(run_id)` 后做完整性校验（日期单调、覆盖率、最新日期滞后阈值）
  - 校验通过才调用 `publish_rps_run`；失败保持旧 run 可见
  - 历史 run 只保留最近 5 次
- 新增工作流 `.github/workflows/refresh-rps-style-snapshots.yml`：
  - 与低波一致的北京时间 20:00-22:00 窗口调度
  - `workflow_dispatch` 支持手动触发并跳过窗口限制
  - 环境变量最小集合：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`

### 3.5 API 路由接入
- 新增 `server/routes/rpsStyle.ts`：
  - `GET /api/rps/summary`
  - `GET /api/rps/matrix`
  - `GET /api/rps/series/:ticker`
- 更新 `server/app.ts`，挂载 `app.use('/api/rps', requireAdminAccess, rpsStyleRoutes)`。

### 3.6 前端数据层
- 修改 `src/utils/marketApi.ts`：
  - 新增类型：`RpsStyleSeriesPoint`、`RpsStyleMatrixItem`、`RpsStyleSummary`
  - 新增请求函数：`fetchRpsStyleSummary()`、`fetchRpsStyleMatrix()`、`fetchRpsStyleSeries(ticker)`
  - 继续复用统一 `ApiOk/ApiErr` 与超时/错误处理模式。

### 3.7 前端页面与导航
- 修改 `src/components/SideNav.tsx`：
  - `HomeTab` 新增 `'rps'`
  - `HOME_TABS` 增加“市场风格RPS”项（icon 可用 `Activity` 或 `LineChart`）。
- 修改 `src/pages/Home.tsx`：
  - `HomeTab` 联合类型与 URL 参数解析加入 `rps`
  - `tab === 'rps'` 时渲染新面板组件
  - 保持其他 tab 行为不变
- 可选兼容修正：`src/pages/QuotesHome.tsx` 的 tab 白名单同步加入 `value/rps`，避免从首页携带 tab 参数时丢失。

### 3.8 RPS 面板与图表（lightweight-charts）
- 新增 `src/components/RpsStylePanel.tsx`：
  - 顶部：状态灯（进攻/防守）、主攻标的、建议仓位、回退状态
  - 中部：RPS 动能矩阵表（分子按 `score_pct` 降序）
  - 指标说明区：明确公式与解读逻辑（RPS、MA50、Score、Risk-On/Risk-Off）
  - 数据状态：复用 `DataStatusBanner`
- 新增 `src/components/charts/RpsStyleChart.tsx`：
  - 继续使用 `lightweight-charts`
  - 支持四个分子相对基准的历史曲线 + MA50
  - 提供时间缩放和 hover tooltip
  - 视觉风格对齐现有 `MarketLiquidityChart/LowVolOpportunityChart`。

## 4. 外部 API 方案调研结论（本次决策）
- 主方案：**Eastmoney qfq 日线**（仓库已有实现、无需额外密钥、前复权参数明确）。
- 兜底方案：**AkShare 子进程抓取 qfq**（利用现有 Python 执行框架，提升可用性）。
- 发布保障：即使外部源失败，也不发布坏 run，沿用上一个可见 run（满足“稳定性优先”）。
- 暂不引入付费 Tushare 作为必需依赖，保持零成本部署；后续可做可选第三兜底。

## 5. Assumptions & Decisions
- 决策已确认：导航形态采用 `market` 子 tab（不是独立路由）。
- 决策已确认：数据源采用免费优先方案（Eastmoney 主 + AkShare 兜底）。
- RPS 模块遵循“低波机会”同构发布范式：全量计算、原子切换、失败不发布、保留 5 次 run。
- `RPS` 在页面中定义为“目标 ETF 前复权收盘价 ÷ 515080 前复权收盘价”的相对比值，不做额外归一化。

## 6. Verification Steps
- 类型与构建检查：
  - `npm run build`
  - `npm run lint`（如项目可用）
- 后端链路验证：
  - 手动执行 `npx tsx server/scripts/refreshRpsStyleSnapshots.ts`（本地/CI）
  - 检查 `rps_style_meta` 是否切换到新 run，`history_run_ids` 是否仅保留 5 条
  - 模拟上游失败，确认 `publish_status=failed` 且 `current_run_id` 不变
- API 验证：
  - `/api/rps/summary`、`/api/rps/matrix`、`/api/rps/series/:ticker` 返回结构与空值处理符合预期
- 前端验收：
  - 左侧导航出现“市场风格RPS”
  - `tab=rps` 可加载状态卡、矩阵表、图表
  - 页面文案完整展示公式与判定逻辑
  - 图表组件确认仍为 `lightweight-charts`
