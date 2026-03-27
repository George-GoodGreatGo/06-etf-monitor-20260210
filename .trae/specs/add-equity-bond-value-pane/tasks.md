# Tasks

- [x] Task 1: 确定并接入股债性价比所需数据源（PE 与 10Y收益率）
  - [x] 确认沪深300 PE（日频）数据源与字段（优先 financedata；不支持则用 AKShare 通道）
  - [x] 确认 10Y 国债收益率（日频）数据源与字段（同上）
  - [x] 明确收益率单位（% 或 小数）并在后端做统一归一化

- [x] Task 2: 后端计算股债性价比与90日分位
  - [x] 计算 `equity_bond_value = (1/PE) - 10Y_yield`
  - [x] 对 value 计算 90 日滚动分位值（min 20）
  - [x] 扩展 `/api/market/liquidity/v5` 返回结构，新增股债性价比序列（raw + pct）
  - [x] 保持与沪深300交易日对齐（对缺失数据做合理 ffill/对齐策略）

- [x] Task 3: 前端类型与数据拉取适配
  - [x] 扩展 `src/utils/marketApi.ts` 类型定义
  - [x] 在流动性 Tab 拉取并传递新序列到图表组件

- [x] Task 4: 图表新增第三窗格（股债性价比分位）
  - [x] 在 `MarketLiquidityChart` 中新增第三个 chart pane（0–100，固定Y轴、禁用Y缩放）
  - [x] 三窗格 timeScale / crosshair / wheel zoom 同步，并严格日期对齐
  - [x] 新窗格小标题：股债性价比（分位）

- [x] Task 5: 验证与回归
  - [x] `npm run build` 通过
  - [x] 手动验证：三窗格日期对齐；滚轮缩放任一窗格都同步；新窗格显示0-100分位且可读
