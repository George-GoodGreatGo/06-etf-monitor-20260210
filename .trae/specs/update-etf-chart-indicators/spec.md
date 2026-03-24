# ETF 详情页图表指标更新 Spec

## Why
用户需要更常用的技术分析指标来观察 ETF 的中长期趋势。目前的 EMA8 和 SMA200 指标将被更新为更符合周线观察习惯的 20周 EMA 和 60周 SMA。

## What Changes
- **后端 (Backend)**:
    - 修改周线图表数据生成逻辑，将 EMA8 计算改为 EMA20，将 SMA200 计算改为 SMA60。
    - **BREAKING**: API 返回的数据结构中，`ema8` 字段名变更为 `ema20`，`sma200` 字段名变更为 `sma60`。
- **前端工具类 (Frontend Utils)**:
    - 更新 `EtfWeeklyChartSeries` 类型定义，匹配后端的字段名变更。
- **前端组件 (Frontend Components)**:
    - 更新 `EtfWeeklyChart.tsx` 组件，使其支持新的指标显示、悬浮提示和控制按钮。

## Impact
- Affected specs: N/A
- Affected code:
    - `server/routes/etf.ts`
    - `src/utils/etfApi.ts`
    - `src/components/charts/EtfWeeklyChart.tsx`

## ADDED Requirements
### Requirement: 更新图表指标
系统应在 ETF 详情页的周线主图中显示：
1. 前复权价格 (QFQ Price)
2. 20周 EMA (EMA20)
3. 60周 SMA (SMA60)

#### Scenario: 成功加载图表
- **WHEN** 用户进入 ETF 详情页
- **THEN** 主图显示 QFQ 价格曲线，以及 20周 EMA 和 60周 SMA 曲线
- **AND** 悬浮提示显示对应的 EMA20 和 SMA60 数值
- **AND** 图表上方的控制按钮显示为 "EMA20" 和 "SMA60"

## MODIFIED Requirements
### Requirement: 移除旧指标
系统不再计算和显示 EMA8 和 SMA200。

## REMOVED Requirements
### Requirement: EMA8 和 SMA200
**Reason**: 用户需求更新，改用 20周 EMA 和 60周 SMA。
**Migration**: 后端 API 和前端组件同步更新字段名和计算逻辑。
