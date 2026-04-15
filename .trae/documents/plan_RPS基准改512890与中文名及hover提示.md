# 计划：RPS 基准改 512890 + 中文名 + Hover 提示

## 1. Summary
- 将 RPS 分母基准从 `515080.SH` 切换为 `512890.SH`（红利低波ETF）。
- 在表格与图表所有涉及 ticker 的展示位置补充 ETF 中文名。
- 折线图支持日期缩放（滚轮/缩放手势），但继续保持左右边界锁定，禁止两侧空白数据区。
- 图表增加 hover 悬浮数据 tips，显示当前时间点各线的数值信息。

## 2. Current State Analysis
- 后端基准在 `server/lib/rpsStyle.ts` 中由常量 `RPS_BENCHMARK_TICKER='515080.SH'` 控制；刷新脚本 `server/scripts/refreshRpsStyleSnapshots.ts` 通过服务输出的 `benchmarkTicker` 回写数据库与质量信息，未硬编码具体 ticker。
- 前端 `src/components/RpsStylePanel.tsx`：
  - 表格仅显示 ticker（无中文名）。
  - 文案与 `baseLabel` 仍写死 `515080.SH`。
- 前端 `src/components/charts/RpsStyleChart.tsx`：
  - 图例只显示 ticker（无中文名）。
  - 已有边界锁定参数 `lockEdges`，但当前禁用滚轮缩放（`handleScale.mouseWheel=false`）。
  - 尚无 hover tips 叠层。
- SQL 迁移 `supabase/migrations/0013_rps_run_model.sql` 中 `benchmark_ticker` 默认值是 `515080.SH`，虽不影响新 run（运行时会写真实 benchmark），但与新策略口径不一致。

## 3. Proposed Changes

### 3.1 后端：分母基准切换到 512890
- 修改文件：`server/lib/rpsStyle.ts`
- 变更内容：
  - `RPS_BENCHMARK_TICKER` 改为 `512890.SH`。
  - 对外 notes 文案中涉及 `515080` 的说明同步改为 `512890`。
- 影响：
  - 新 run 的 `benchmark_ticker`、`rps_raw`、`rps_ma50`、`score_pct` 自动按新分母重算。

### 3.2 数据库口径一致性（可选但建议）
- 修改文件：`supabase/migrations/0013_rps_run_model.sql` 或新增增量迁移（推荐新增）。
- 变更内容：
  - `rps_style_point.benchmark_ticker` 默认值更新为 `512890.SH`，避免后续结构认知偏差。
- 说明：
  - 这是口径一致性修正，不改变既有历史 run 的已存值。

### 3.3 前端：ticker 中文名映射与展示
- 修改文件：`src/components/RpsStylePanel.tsx`、`src/components/charts/RpsStyleChart.tsx`
- 方案：
  - 在前端新增静态映射（局部常量）：
    - `512890.SH -> 红利低波ETF`
    - `159915.SZ -> 创业板ETF`
    - `588000.SH -> 科创50ETF`
    - `513180.SH -> 恒生科技ETF`
    - `510300.SH -> 沪深300ETF`
  - 表格 ticker 列展示为：`代码 + 中文名`。
  - 图例展示为：`代码（中文名）`。
  - 说明文案与 `baseLabel` 改为 `512890.SH=1` 并显示中文名。

### 3.4 图表交互：允许缩放 + 锁边界防空白
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 变更内容：
  - 开启日期缩放：`handleScale.mouseWheel=true`（保留轴拖拽禁用，避免通过轴拖出空白）。
  - 保留/强化锁边界配置：
    - `timeScale.fixLeftEdge=true`
    - `timeScale.fixRightEdge=true`
    - `timeScale.rightOffset=0`
  - 继续在数据更新后显式设置可见范围到实际数据最小/最大时间，确保任意拖拽/缩放后不出现两侧空白。

### 3.5 图表 hover tips
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 变更内容：
  - 新增 `hover` 状态与 `chart.subscribeCrosshairMove` 监听。
  - 在图表右上角新增悬浮信息卡，显示：
    - 日期
    - 每个 ticker 的 `RPS`（实线）值
    - 每个 ticker 的 `MA50`（虚线）值
    - 相对视图下仍显示归一化值（与图中刻度一致）
  - 离开图表或无有效点时隐藏 tips。

## 4. Assumptions & Decisions
- 中文名映射采用前端静态字典实现，不新增后端字段（当前标的池固定且稳定）。
- 基准切换后需要重新跑一次 `refreshRpsStyleSnapshots` 才能让前端看到新口径数据。
- hover tips 采用与现有图表风格一致的“右上角半透明卡片”方案。

## 5. Verification Steps
- 数据口径验证：
  - 执行 `npx tsx server/scripts/refreshRpsStyleSnapshots.ts` 后，确认输出与 `qualitySummary.benchmarkTicker` 为 `512890.SH`。
  - API `/api/rps/matrix` 返回的 `benchmarkTicker` 为 `512890.SH`。
- 展示验证：
  - 表格 ticker 列含“代码+中文名”。
  - 图例显示“代码（中文名）”。
  - 页面说明文案中的分母与基线为红利低波ETF（512890）。
- 交互验证：
  - 鼠标滚轮可缩放时间轴。
  - 拖拽和缩放后左右不出现空白区。
  - hover 时出现 tips，离开后消失。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx`、`RpsStyleChart.tsx`、`server/lib/rpsStyle.ts` 无新增诊断错误。
