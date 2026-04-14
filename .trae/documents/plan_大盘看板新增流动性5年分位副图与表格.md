# 计划：大盘看板新增“独家流动性指数（5年分位）”副图与表格展示

## 1. Summary
- 目标：在“大盘看板”中新增 `独家流动性指数（5年分位）`（即 `v5Pct`）的独立副图，并在表格同步展示该列。
- 口径：分位阈值使用 `20/80`（稳健版）；样本不足阶段（窗口样本 `<630`）明确标记“样本不足”。
- 交互决策：保留现有两个副图（`v5` 与 `股债分位`），新增第三个副图用于 `v5Pct`；样本不足时“显示数值 + 标记不足”。

## 2. Current State Analysis
- 后端数据已具备 `v5Pct`：
  - `server/lib/marketBoardSupabaseService.ts` 在返回 `series` 时已映射 `v5_pct -> v5Pct`。
- 前端类型尚未声明 `v5Pct`：
  - `src/utils/marketApi.ts` 的 `LiquidityV5Point` 仅到 `v5`，缺少 `v5Pct` 字段。
- 图表当前仅有两个副图：
  - `src/components/charts/MarketLiquidityChart.tsx` 现有副图为 `v5`（含 30/70 线）和 `equityBond.pct`。
  - 尚未创建 `v5Pct` 副图，也没有 `20/80` 阈值带。
- 表格未展示 `v5Pct`：
  - `src/components/MarketLiquidityTable.tsx` 当前列包含 `v5` 与 `股债分位`，未包含 `v5Pct`。
- 面板文案未说明新指标：
  - `src/components/MarketLiquidityPanel.tsx` 说明文案只提到“3指标流动性指数”和“股债性价比分位”。

## 3. Proposed Changes

### A. 前端数据类型与接口对齐
- 文件：`src/utils/marketApi.ts`
- 变更：
  - 在 `LiquidityV5Point` 中新增 `v5Pct: number | null`。
- 原因：
  - 解除类型层丢字段问题，保证图表与表格可以安全消费后端已返回的 `v5Pct`。

### B. 图表新增第三副图（v5Pct）
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 变更：
  - 在现有 `price / v5 / eb` 基础上新增 `v5Pct` 子图容器与图实例。
  - 增加 `v5Pct` 线数据（来源 `series[].v5Pct`）。
  - 为 `v5Pct` 子图新增阈值线 `20` 与 `80`。
  - 为 `v5Pct` 子图新增机会/风险背景区（<=20、>=80）。
  - 在 hover 信息中增加 `v5Pct` 展示（与 `v5` 并列）。
  - 时间轴联动、尺寸联动、crosshair 联动纳入新子图。
  - 在 `v5Pct` 子图左上角标题加入样本不足标识逻辑（当有效样本数 `<630` 时显示“样本不足”）。
- 原因：
  - 按产品决策“新增第三副图”展示，避免与 `v5` 混图造成量纲混淆。

### C. 表格新增 v5Pct 列与样本不足标记
- 文件：`src/components/MarketLiquidityTable.tsx`
- 变更：
  - 增加列：`独家流动性指数（5年分位）`。
  - 每行显示 `v5Pct`（格式同分位字段，通常 1 位小数）。
  - 在 `v5Pct` 单元格增加“样本不足”标记规则：若该日期之前可用 `v5Pct` 样本数量 `<630`，在值后追加提示；若值为空则显示 `—（样本不足）`。
- 原因：
  - 满足“图表+表格同步展示”与“避免误读”的需求。

### D. 面板说明文案补充
- 文件：`src/components/MarketLiquidityPanel.tsx`
- 变更：
  - 在指标说明区新增一条文案：`独家流动性指数（5年分位）` 的定义（`v5` 的5年滚动分位）与阈值 `20/80` 含义。
  - 说明“样本不足（<630）阶段会显示标记”。
- 原因：
  - 保证用户理解新副图的语义与阈值口径。

## 4. Assumptions & Decisions
- 已确认决策：
  - 图表采用“新增第三副图”，而非替换/叠加。
  - 样本不足展示策略为“显示数值 + 标记不足”。
  - `v5Pct` 阈值采用 `20/80`。
- 假设：
  - 后端 `series.v5Pct` 已稳定返回，且与 `series.date` 一一对齐。
  - 样本不足判定可在前端按可用分位点累计计数完成，无需新增后端字段。

## 5. Verification Steps
- 类型与构建：
  - 运行 `npm run check`，确保 TS 类型与前端构建通过。
- 功能验证（图表）：
  - 图表出现第三副图：`独家流动性指数（5年分位）`。
  - 可见 `20/80` 阈值线与机会/风险背景区。
  - hover 卡片可同时看到 `v5` 与 `v5Pct`。
  - 时间轴缩放与十字线在三个副图联动正常。
- 功能验证（表格）：
  - 新增 `v5Pct` 列，数值格式正确。
  - 在历史前段（样本不足）可见“样本不足”标记；后段样本充足时不再标记。
- 文案验证：
  - 面板说明新增 `v5Pct` 定义、阈值 `20/80`、样本不足说明，且与图表行为一致。
