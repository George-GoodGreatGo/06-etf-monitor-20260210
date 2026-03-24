# ETF 详情页图表添加布林带 (Bollinger Bands) Spec

## Why
布林带是投资者常用的技术指标，通过标准差量化价格波动范围，帮助识别买卖信号和波动率变盘点（收口宽度）。

## What Changes
- **后端 (Backend)**:
    - 在 `server/routes/etf.ts` 中新增 `calcBollingerBands` 函数，严格按照提供的逻辑计算 MB, UB, LB 和 bandwidth。
    - 更新 `WeeklyChartSeries` 类型，增加 `bb` 字段，包含 `mb`, `ub`, `lb` 和 `bandwidth` 序列。
    - 修改 `buildWeeklyChartVercel` 函数，在获取周线数据后计算布林带并返回。
- **前端工具类 (Frontend Utils)**:
    - 更新 `src/utils/etfApi.ts` 中的 `EtfWeeklyChartSeries` 类型定义，同步增加 `bb` 字段及其子序列。
- **前端组件 (Frontend Components)**:
    - 更新 `src/components/charts/EtfWeeklyChart.tsx` 组件：
        - 新增 `showBB` 状态控制显示。
        - 在主图中添加 MB, UB, LB 三条曲线（MB 为中轨，UB/LB 为上下轨，可使用半透明区域填充或不同颜色线段）。
        - 在悬浮提示 (Legend) 中展示当前 K 线的布林带数值和带宽高 (Bandwidth)。
        - 在图表上方工具栏添加“布林带”切换按钮。

## Impact
- Affected code:
    - `server/routes/etf.ts`
    - `src/utils/etfApi.ts`
    - `src/components/charts/EtfWeeklyChart.tsx`

## ADDED Requirements
### Requirement: 布林带计算与显示
系统应在 ETF 周线图中支持布林带指标：
1. **中轨 (MB)**: 20周简单移动平均线 (SMA20)。
2. **上轨 (UB)**: 中轨 + 2倍标准差。
3. **下轨 (LB)**: 中轨 - 2倍标准差。
4. **带宽 (Bandwidth)**: (UB - LB) / MB。

#### Scenario: 切换显示
- **WHEN** 用户点击图表上方的“布林带”按钮
- **THEN** 主图中显示/隐藏 MB, UB, LB 三条曲线
- **AND** 悬浮提示中显示/隐藏对应的布林带数值

## MODIFIED Requirements
### Requirement: 悬浮提示更新
悬浮提示应在展示价格、均线的基础上，根据布林带是否开启，显示 MB, UB, LB 和 Bandwidth。

## REMOVED Requirements
N/A
