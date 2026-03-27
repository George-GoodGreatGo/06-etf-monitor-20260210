# 流动性图表新增“股债性价比（分位）”副图 Spec

## Why
当前首页「流动性指数」图表只展示沪深300与V5流动性分位，缺少对“股票相对债券吸引力”的量化刻画。希望新增一个副图展示【股债性价比】指标的分位值，帮助快速判断在历史视角下更偏向股票还是国债。

## What Changes
- 在现有流动性图表中新增第三个窗格副图：**股债性价比（分位）**。
- 指标定义：`equity_bond_value = (1 / PE_CSI300) - YIELD_10Y_CN`，其中 `1/PE` 使用沪深300的 PE（按日），`YIELD_10Y_CN` 为中国10年期国债收益率（按日）。
- 对 `equity_bond_value` 计算 **滚动90日分位值**（最小有效天数 20），分位值范围 0–100：
  - 分位值越大：股票越有性价比
  - 分位值越小：国债越有性价比
- 三个窗格（沪深300主图 / V5副图 / 股债性价比副图）**日期严格对齐**，共享同一 X 轴范围与十字光标联动。

## Impact
- Affected specs: 首页「流动性指数」Tab
- Affected code:
  - `server/routes/market.ts`（扩展返回字段/数据源抓取/缓存）
  - `server/lib/financeData.ts`（复用数据抓取封装，必要时扩展字段解析）
  - `server/lib/liquidityV5.ts`（可复用滚动分位数实现或抽出共用函数）
  - `src/utils/marketApi.ts`（前端类型定义扩展）
  - `src/components/charts/MarketLiquidityChart.tsx`（新增第三窗格与同步交互）
  - `src/components/MarketLiquidityPanel.tsx`（文案与信息展示，如需）

## ADDED Requirements
### Requirement: 计算股债性价比指标与分位
系统 SHALL 按以下规则计算并输出股债性价比序列：
- **Input**：
  - `PE_CSI300`：沪深300 PE（日频，按交易日对齐）
  - `YIELD_10Y_CN`：10年期国债收益率（日频）
- **Normalization**：
  - `earnings_yield = 1 / PE_CSI300`（PE <= 0 或缺失则当日为 null）
  - `bond_yield = YIELD_10Y_CN`（若数据源单位为“百分比”，系统 SHALL 转换为小数：`bond_yield = yield_pct / 100`）
- **Value**：`equity_bond_value = earnings_yield - bond_yield`
- **Percentile**：对 `equity_bond_value` 计算 90 日滚动分位值（min_periods=20）

#### Scenario: 输出分位值序列
- **WHEN** 后端成功获取所需的 PE 与 10Y 国债收益率数据
- **THEN** 接口返回 `equityBond.pctSeries`（0–100）
- **AND** 返回序列日期与沪深300主图交易日对齐

### Requirement: 图表三窗格日期对齐
系统 SHALL 在图表层保证三窗格在 X 轴上严格对齐：
- 主图：沪深300收盘价
- 副图1：V5（0–100，已有）
- 副图2：股债性价比分位（0–100）

#### Scenario: 缺失值不影响对齐
- **GIVEN** 股债性价比分位在前若干日因窗口不足为 null
- **WHEN** 用户缩放/拖拽任一窗格
- **THEN** 三窗格仍保持同一时间范围，不出现起止错位

## Notes / Open Items
- 当前仓库中未发现“沪深300 PE”“10年期国债收益率”的既有数据接口或 `financedata api_name`，实现阶段需要先确定数据源：
  - 优先方案：继续使用 `https://www.codebuddy.cn/v2/tool/financedata` 并确认对应 `api_name/fields`
  - 备选方案：若 financedata 不支持，使用现有 Python/AKShare 数据通道补齐（日频 PE 与 10Y 收益率）

