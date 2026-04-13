# 沪深市场大盘看板：新增“独家流动性指数（3指标）-5年滚动分位（v5Pct）” Spec

## Why
当前独家流动性指数（v5）是三项分位的几何平均，其绝对值通常难以触达 100，直接用 v5 的 30/70 阈值会让“是否处于历史极端”不够直观。新增 v5 的 5 年滚动分位（v5Pct, 0–100）可更清晰表达“综合流动性在近 5 年中的相对位置”，提升指标解释性与可用性。

## What Changes
- 服务端在现有大盘看板数据结构中新增字段：`v5Pct`（独家流动性指数 v5 的 5 年滚动分位，0–100）。
- 图表视图增加 1 个副图窗格，用于展示 `v5Pct`（0–100，固定 Y 轴并禁止 Y 缩放）。
- 表格视图新增 1 列展示 `v5Pct`，并标注单位为 `%`。
- 看板“指标说明”补充 v5Pct 的定义与指示意义说明。

## Impact
- Affected specs:
  - 大盘看板图表视图（新增 v5Pct 副图）
  - 大盘看板表格视图（新增 v5Pct 列）
  - 大盘看板指标说明（新增 v5Pct 说明）
- Affected code:
  - `server/lib/liquidityV5.ts`（计算并输出 v5Pct）
  - `server/lib/marketLiquidityV5Service.ts`（接口 notes/meta 口径说明同步）
  - `src/utils/marketApi.ts`（类型扩展：LiquidityV5Point 新增 v5Pct）
  - `src/components/charts/MarketLiquidityChart.tsx`（新增 v5Pct 副图窗格与联动）
  - `src/components/MarketLiquidityTable.tsx`（新增 v5Pct 列与单位）
  - `src/components/MarketLiquidityPanel.tsx`（指标说明补充 v5Pct 的意义）

## ADDED Requirements
### Requirement: 新增 v5Pct 指标
系统 SHALL 输出 `v5Pct`，其定义为对 `v5` 进行 5 年滚动分位计算得到的 0–100 指标。

#### Scenario: v5Pct 计算
- **GIVEN** 系统已计算得到独家流动性指数序列 `v5`
- **WHEN** 系统计算 `v5Pct`
- **THEN** 对每个交易日使用近 5 年窗口（windowDays≈1260）计算 `v5` 的分位（0–100）
- **AND** 若近 5 年窗口内有效数据点 < minPeriods，则当日 `v5Pct` 为 null/NaN
- **AND** 若当日 `v5` 为 null，则当日 `v5Pct` 为 null

#### Parameters
- windowDays = 1260（按交易日近似）
- minPeriods = 630

### Requirement: 图表新增 v5Pct 副图
系统 SHALL 在大盘看板图表视图中新增一个 v5Pct 副图窗格，并与其它窗格保持交互联动。

#### Scenario: v5Pct 副图渲染与轴设置
- **WHEN** 用户查看大盘看板图表视图
- **THEN** 新增窗格展示 `v5Pct` 折线
- **AND** 该窗格 Y 轴固定为 0–100 且禁止 Y 缩放
- **AND** 与现有主图/其它副图共享时间轴联动（缩放、拖拽、十字光标）

### Requirement: 表格视图新增 v5Pct 列
系统 SHALL 在大盘看板表格视图中新增一列展示 `v5Pct`，并明确单位为 `%`。

#### Scenario: 表格展示 v5Pct
- **WHEN** 用户查看某一交易日的表格行
- **THEN** 展示该日 `v5Pct` 数值（缺失则显示 “—”）
- **AND** 列标题或单位提示中包含 `%`

### Requirement: 指标说明补充 v5Pct 的指示意义
系统 SHALL 在看板指标说明中补充 v5Pct 的定义与解读方法。

#### Scenario: 指标说明内容
- **WHEN** 用户查看“沪深市场大盘看板”标题下方指标说明
- **THEN** 能看到 v5Pct 的定义（v5 的 5 年滚动分位，0–100）
- **AND** 能看到 v5Pct 的指示意义：
  - 分位越高表示近 5 年内综合流动性越偏“高位/过热”
  - 分位越低表示近 5 年内综合流动性越偏“低位/冷却”
  - v5Pct 属于相对刻度，用于判断“是否处于历史极端”，而非绝对流动性大小

## MODIFIED Requirements
N/A

## REMOVED Requirements
N/A

