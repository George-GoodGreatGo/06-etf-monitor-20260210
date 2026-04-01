# Tasks

- [x] 1. 设计表格视图的数据字段与列分组
  - [x] 1.1 明确列：日期、沪深300 close、（流动性：amount/tr/north + 分位 + v5）、（股债：pe/收益率/10Y/value/pct）
  - [x] 1.2 明确默认展示范围（建议默认最近 720 行）与滚动/粘性表头方案
- [x] 2. 后端：补齐表格视图所需数据
  - [x] 2.1 扩充 `buildLiquidityV5Series` 输出：增加 amount、tr、northMoney（原始值或对齐后的值）字段
  - [x] 2.2 扩充 `buildEquityBondValuePctSeries` 输出：增加 pe、earningsYield、yield10yPct（或 yield10y）、value、pct 字段
  - [x] 2.3 更新 `GET /api/market/liquidity/v5` 返回结构（或新增 `GET /api/market/liquidity/v5/table`），保证图表视图不被破坏
- [x] 3. 前端：实现大盘看板“图表/表格”切换
  - [x] 3.1 在 `MarketLiquidityPanel.tsx` 增加视图切换控件（与现有按钮风格一致）
  - [x] 3.2 图表视图：复用 `MarketLiquidityChart`
  - [x] 3.3 表格视图：新增表格组件（建议 `MarketLiquidityTable`），支持滚动与缺失值展示
- [x] 4. 前端：类型与数据适配
  - [x] 4.1 更新 `src/utils/marketApi.ts` 的类型定义，包含新增字段
  - [x] 4.2 确保图表仍可正常渲染（不依赖新增字段）
- [x] 5. 回归验证
  - [x] 5.1 `npm run check` 通过
  - [x] 5.2 表格视图字段完整、口径与图表一致、缺失值显示正确
  - [x] 5.3 切换视图不影响图表状态（EMA/BOLL/面板开关保持）

# Task Dependencies
- 3 依赖 2 与 4
