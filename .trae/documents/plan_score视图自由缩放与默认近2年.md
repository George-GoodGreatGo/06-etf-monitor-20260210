# 计划：Score 视图自由缩放与默认近2年

## 1. Summary
- 针对 `MA50归一视图（Score走势）` 调整交互规则：
  - 不再受“时间区间”筛选约束（请求数据按全历史加载）。
  - 取消该视图的时间选择功能（UI 隐藏时间范围控件）。
  - 默认进入该视图时，图表初始可见范围定位到“最近2年”。
- 保留已有的缩放能力：滚轮 + X/Y 轴拖拽；但拖拽/缩放仍不能越过已加载数据边界（不出现空白区）。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx`
  - 当前 `chartView !== 'raw'` 时都会传 `startDate/endDate`，因此 `score` 受时间区间约束。
  - 时间范围控件当前也在 `chartView !== 'raw'` 下显示，`score` 也可选时间。
- `src/components/charts/RpsStyleChart.tsx`
  - 已支持滚轮与轴拖拽缩放（`axisPressedMouseMove: true`）。
  - 现有逻辑每次会把可见范围设为全部已加载数据边界（`setVisibleRange(min,max)`），没有“score 首次默认近2年”的初始化行为。

## 3. Proposed Changes

### 3.1 Panel：score 视图取消时间选择与区间参数
- 修改文件：`src/components/RpsStylePanel.tsx`
- 改动点：
  - `fetchRpsStyleSeries` 参数策略调整：
    - `raw`：不传 `startDate/endDate`（保持全历史）。
    - `relative`：传 `startDate/endDate`（保持原逻辑）。
    - `score`：不传 `startDate/endDate`（改为全历史，不受时间区间约束）。
  - 时间范围控件显示条件从 `chartView !== 'raw'` 改为仅 `chartView === 'relative'`。
  - `custom` 起点的“提交制”只对 `relative` 生效；`score` 切换时不阻塞请求。

### 3.2 Chart：score 视图默认定位最近2年
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动点：
  - 在 `viewMode==='score'` 且有数据时：
    - 计算“最新时间点 - 2年”作为默认左边界（按秒级 UTC）。
    - 可见范围设为 `[max(minTime, twoYearsAgo), maxTime]`。
  - 非 `score` 视图保持现有边界逻辑（`raw/relative`）。
  - 仍保留 `fixLeftEdge/fixRightEdge/rightOffset`，确保缩放拖拽不超出数据边界。

### 3.3 交互边界与一致性
- 修改文件：`src/components/charts/RpsStyleChart.tsx`（逻辑微调）
- 说明：
  - score 视图默认近2年仅是“初始可见窗口”，后续允许用户自由缩放/拖拽查看更早历史（在有数据范围内）。
  - 与需求一致：自由拖拽缩放不再受“时间区间按钮”限制，但仍受“数据边界”限制。

## 4. Assumptions & Decisions
- 仅取消 `score` 视图时间选择；`relative` 继续保留时间区间与自定义起点逻辑。
- `score` 视图请求全历史会增加前端数据量，但标的数量固定（4个）且可接受。
- “默认最近2年”定义为：从最新数据日期向前约 730 天（若历史不足2年则显示全量）。

## 5. Verification Steps
- 功能验证：
  - 切到 `MA50归一视图（Score走势）` 时，时间范围控件不显示。
  - score 视图首屏默认显示最近2年窗口（右侧为最新日期）。
  - 用户可继续拖拽/缩放查看更长历史，不受时间区间按钮影响。
- 约束验证：
  - 任意缩放/拖拽后，左右不出现空白无数据区域。
- 回归验证：
  - `RPS起点归一` 的时间范围与自定义起点功能保持正常。
  - `原始视图` 行为不变。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx`、`RpsStyleChart.tsx` 诊断无新增错误。
