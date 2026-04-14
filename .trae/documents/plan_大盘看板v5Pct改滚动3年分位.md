# 计划：大盘看板 v5Pct 改为滚动3年分位

## 1. Summary
- 目标：将“大盘看板”中的“独家流动性指数（5年分位）`v5Pct`”统一改为“滚动3年分位”口径。
- 范围（已确认）：仅改 `v5Pct`；不改三指标原指数 `v5` 的构造窗口，不改股债分位窗口。
- 参数（已确认）：`window≈756`（3年交易日），`minPeriods≈378`（半窗）；样本不足阈值同步改为 `<378`。
- 历史数据策略（已确认）：后端重算并全量回灌 Supabase。

## 2. Current State Analysis
- 后端存储与前端消费：
  - `server/lib/marketBoardSupabaseService.ts` 已将 `v5_pct` 映射为前端 `v5Pct`。
  - `src/components/charts/MarketLiquidityChart.tsx` 与 `src/components/MarketLiquidityTable.tsx` 已展示 `v5Pct`。
- 现口径与文案仍是 5 年：
  - `server/lib/marketLiquidityV5Service.ts` 元数据注释仍写 `v5Pct=rollingPercentilePct(v5,1260,630)`。
  - `src/components/MarketLiquidityPanel.tsx` 文案仍写“5年滚动（≈1260，最少≈630）”。
  - `src/components/MarketLiquidityTable.tsx` 与 `src/components/charts/MarketLiquidityChart.tsx` 样本不足阈值仍以 `630` 判定。
- 回灌链路：
  - `server/scripts/refreshMarketBoardPoints.ts` 通过 `getMarketLiquidityV5` 写入 `v5_pct`，因此口径变更必须进入后端计算并触发全量回灌。

## 3. Proposed Changes

### A. 后端：将 v5Pct 计算窗口改为 3 年（756/378）
- 文件：`server/lib/marketLiquidityV5Service.ts`（必要时联动 `server/lib/liquidityV5.ts`）
- 变更：
  - 在输出 `series` 前，按 `v5` 计算 `v5Pct` 的滚动分位，参数改为 `window=756, minPeriods=378`。
  - 若当前实现已有 `v5Pct` 计算函数，则直接改窗口参数；若无集中计算点，则新增一个仅用于 `v5Pct` 的滚动分位计算步骤并挂载到 `series`。
  - 更新 `calcVersion`（避免旧缓存混用）与相关 notes 文案，明确 `v5Pct` 口径为“3年滚动分位（756/378）”。
- 原因：
  - 确保 API、回灌脚本、Supabase 入库口径一致，避免前端临时计算造成双口径。

### B. 前端：展示文案与样本不足阈值改为 3 年口径
- 文件：`src/components/MarketLiquidityPanel.tsx`
- 变更：
  - 将“独家流动性指数（5年分位）”文案改为“独家流动性指数（3年分位）”。
  - 文案中的窗口参数改为 `≈756`、最小样本改为 `≈378`。
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 变更：
  - 第三副图标题改为“独家流动性指数（3年分位）”。
  - 样本不足判定由 `<630` 改为 `<378`（阈值 `20/80` 保持不变）。
- 文件：`src/components/MarketLiquidityTable.tsx`
- 变更：
  - 列标题改为“独家流动性指数（3年分位）”。
  - “样本不足”标记阈值由 `<630` 改为 `<378`。
- 原因：
  - 展示层与后端计算口径一致，避免用户误读。

### C. 数据发布：按新口径全量重算回灌
- 文件：`server/scripts/refreshMarketBoardPoints.ts`（流程不改，执行策略更新）
- 变更：
  - 使用现有 backfill 流程全量重算并覆盖写入 Supabase。
  - 继续沿用原子发布与 run 历史保留逻辑，不新增表结构变更。
- 原因：
  - 用户已确认采用“后端重算并全量回灌”，确保历史曲线口径统一。

## 4. Assumptions & Decisions
- 已锁定决策：
  - 仅改 `v5Pct` 为 3 年分位；`v5` 与股债分位窗口不变。
  - `v5Pct` 参数为 `756/378`。
  - 历史数据采用后端全量回灌更新。
- 约束：
  - 副图阈值 `20/80` 保持不变。
  - 不新增 Supabase schema migration（本次为口径与展示层变更）。

## 5. Verification Steps
- 静态检查：
  - 运行 `npm run check`，确保类型与编译通过。
- 后端口径验证：
  - 本地/预发调用 `/api/market/liquidity/v5`，确认 `series` 中 `v5Pct` 按 3 年口径出值，且早期阶段存在 `null`（样本不足）。
  - 核对返回 `meta.notes`/`calcVersion` 文案已更新为 3 年口径。
- 前端展示验证：
  - 图表第三副图标题显示“3年分位”，`20/80` 阈值仍在。
  - 样本不足标签在 `<378` 时出现，达到阈值后自动消失。
  - 表格列标题与单元格样本不足标记均改为 3 年口径。
- 回灌验证：
  - 执行一次 backfill，确认新 run 发布后前端读取的新 run `v5Pct` 曲线发生口径切换且无空白异常。
