# 计划：大盘看板 v5Pct 恢复 5 年滚动分位

## 1. Summary
- 目标：将“大盘看板”的 `独家流动性指数（3年分位）` 回切为 `5年滚动分位` 口径。
- 目标参数：`window≈1260`、`minPeriods≈630`。
- 影响范围：仅 `v5Pct`（独家流动性指数分位）；不调整原始 `v5` 三指标构造，不调整股债分位窗口。
- 数据策略：口径变更后执行一次全量 backfill，确保 Supabase 历史序列统一。

## 2. Current State Analysis
- 后端当前为 3 年口径：
  - `server/lib/marketLiquidityV5Service.ts` 中 `calcVersion='pct-window-v5pct-3y-v1'`。
  - `attachV5Pct3y()` 使用 `rollingPercentilePct(v5, 756, 378)`。
  - `meta.notes` 文案写明 `v5Pct=rollingPercentilePct(v5,756,378)`。
- 前端当前为 3 年展示：
  - `src/components/MarketLiquidityPanel.tsx` 文案写“3 年滚动分位（≈756，最少≈378）”。
  - `src/components/charts/MarketLiquidityChart.tsx` 标题为“独家流动性指数（3年分位）”，样本不足阈值 `<378`。
  - `src/components/MarketLiquidityTable.tsx` 列标题为“独家流动性指数（3年分位）”，样本不足阈值 `<378`。
- 数据写入链路：
  - `server/scripts/refreshMarketBoardPoints.ts` 读取 `getMarketLiquidityV5()` 结果并写入 `v5_pct`，因此无需 schema 变更，只需回切计算口径并回灌。

## 3. Proposed Changes

### A. 后端口径回切（3y -> 5y）
- 文件：`server/lib/marketLiquidityV5Service.ts`
- 变更：
  - `calcVersion` 从 `pct-window-v5pct-3y-v1` 改为新的 5 年版本（如 `pct-window-v5pct-5y-v1`），避免旧缓存混用。
  - 将 `v5Pct` 计算参数从 `756/378` 改回 `1260/630`（函数名与实现同步改名/回切，保持可读性）。
  - 更新 notes 文案为 `v5Pct=rollingPercentilePct(v5,1260,630)` 与“5 年滚动分位”描述。
- 原因：
  - 保证 API 输出、缓存版本和元数据说明一致，避免口径混淆。

### B. 前端展示回切到 5 年口径
- 文件：`src/components/MarketLiquidityPanel.tsx`
- 变更：
  - 文案回切为“独家流动性指数（5年分位）”。
  - 参数回切为“≈1260，最少≈630”，样本不足文案回切为 `<630`。
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 变更：
  - 第三副图标题改回“独家流动性指数（5年分位）”。
  - 样本不足阈值从 `<378` 改回 `<630`。
  - 阈值线 `20/80` 保持不变（本次不改策略阈值）。
- 文件：`src/components/MarketLiquidityTable.tsx`
- 变更：
  - 列标题改回“独家流动性指数（5年分位）”。
  - 样本不足判定从 `<378` 改回 `<630`。
- 原因：
  - 展示层与后端回切后的 5 年计算口径保持一致。

### C. 数据发布与回灌
- 文件：`server/scripts/refreshMarketBoardPoints.ts`（代码流程不改）
- 执行步骤：
  - 部署后触发一次 `backfill` 全量重算（2016-01-01 至今）。
  - 通过现有原子发布流程切换到新 run。
- 原因：
  - 防止 Supabase 中历史 `v5_pct` 混有 3 年与 5 年双口径。

## 4. Assumptions & Decisions
- 已确认：
  - 仅回切 `v5Pct` 到 5 年（1260/630）。
  - 不改 `v5` 三指标分位口径，不改股债分位口径。
  - 样本不足阈值与分位窗口保持一致，回切为 `<630`。
- 约束：
  - 不做 Supabase schema migration（字段不变，仅数值口径回切）。

## 5. Verification Steps
- 静态验证：
  - 运行 `npm run check`，确保类型和编译通过。
- 代码口径验证：
  - 检查 `marketLiquidityV5Service` 中 `v5Pct` 参数已为 `1260/630`，`calcVersion` 已切换，notes 已更新。
  - 检查 Panel/Chart/Table 文案与样本不足阈值均回切至 5 年口径。
- 运行时验证：
  - 调用 `/api/market/liquidity/v5`，确认 `meta.notes` 展示 5 年口径。
  - 触发 backfill 后确认前端图表与表格展示正常，无空白/错误提示。
