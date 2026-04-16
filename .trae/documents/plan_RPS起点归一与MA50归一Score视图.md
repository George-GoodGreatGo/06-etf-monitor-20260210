# 计划：RPS“起点归一”命名与新增“MA50归一视图（Score走势）”

## 1. Summary
- 将现有“起点视图”命名改为“RPS起点归一”。
- 新增第三种图表视图：`MA50归一视图（Score走势）`。
- 新视图核心口径：以 `scorePct`（即 `(RPS/MA50 - 1)*100%`）作为 Y 值，`Y=0` 作为 MA50 基线，比较各目标指数在同一时间窗内的 Score 走势。
- 时间选择逻辑与“RPS起点归一”一致（同一套范围按钮与自定义起点提交机制）。
- 默认视图维持为“RPS起点归一”。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx`
  - 目前仅两个视图：`relative`（文案“起点视图”）与 `raw`（文案“原始视图”）。
  - 时间范围控件仅在 `chartView==='relative'` 时显示与生效。
  - 默认视图 `chartView='relative'`，默认范围 `1y`，自定义日期“提交制”已实现。
- `src/components/charts/RpsStyleChart.tsx`
  - 目前仅支持 `viewMode: 'raw' | 'relative'`。
  - `relative` 逻辑是将 `rpsRaw` 和 `rpsMa50` 按起点归一到 1。
  - 图例、hover、参考线均按这两种视图渲染。
- `src/utils/marketApi.ts`
  - `RpsStyleSeriesPoint` 已包含 `scorePct`，无需后端新增字段。

## 3. Proposed Changes

### 3.1 Panel：视图枚举与文案
- 修改文件：`src/components/RpsStylePanel.tsx`
- 变更内容：
  - 扩展 `RpsViewMode`：`'raw' | 'relative' | 'score'`。
  - 按钮文案改名：
    - `起点视图` -> `RPS起点归一`
    - 新增按钮：`MA50归一视图（Score走势）`
  - 默认值保持 `chartView='relative'`（即默认“RPS起点归一”）。
  - 说明文案中“起点视图”同步改为“RPS起点归一”。

### 3.2 Panel：时间范围生效条件扩展
- 修改文件：`src/components/RpsStylePanel.tsx`
- 变更内容：
  - 目前仅 `relative` 使用时间范围；改为 `relative` 与 `score` 共用时间范围。
  - 即：
    - 请求 `fetchRpsStyleSeries` 时，`chartView !== 'raw'` 透传 `startDate/endDate`。
    - 时间范围控件显示条件改为 `chartView !== 'raw'`。
    - 自定义起点“提交制”逻辑对 `score` 也生效。

### 3.3 Chart：新增 score 视图渲染
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 变更内容：
  - `Props.viewMode` 扩展到 `'raw' | 'relative' | 'score'`。
  - `prepared` 计算分支新增 `score`：
    - 主线（实线）取 `scorePct`。
    - 副线（虚线）固定为 `0` 参考线（代表 MA50 归一基线）。
    - 数据映射到 hover 中显示：`Score` 与 `基线(0)`。
  - 参考线逻辑：
    - `relative`：保留 `y=1`。
    - `score`：新增 `y=0`（强调正负动能分界）。
  - 图例文案：
    - `raw`：`RPS 实线 / MA50 虚线`
    - `relative`：`归一化RPS 实线 / 归一化MA50 虚线`
    - `score`：`Score 实线 / MA50归一基线(0) 虚线`
  - hover tips：
    - `score` 模式下展示每个 ticker 的 `Score` 值（保留 ticker 中文名）。

### 3.4 类型与兼容
- 修改文件：`src/components/RpsStylePanel.tsx`、`src/components/charts/RpsStyleChart.tsx`
- 保持不变：
  - 后端接口与 `marketApi.ts` 类型无需改动（已有 `scorePct`）。
  - `raw` 与 `relative` 的已有行为保持兼容。

## 4. Assumptions & Decisions
- 已确认：默认视图仍为“RPS起点归一”。
- “MA50归一视图（Score走势）”中的“归一为0”解释为：
  - 直接使用 `scorePct`，其天然以 `0` 为 MA50 基线。
- 原始视图继续不展示时间范围；`RPS起点归一` 与 `MA50归一视图`共用同一时间选择机制。

## 5. Verification Steps
- 视图与命名：
  - 视图按钮显示：`RPS起点归一`、`MA50归一视图（Score走势）`、`原始视图`。
  - 默认进入 `RPS起点归一`。
- 时间范围：
  - 切换到 `MA50归一视图` 时可使用与 `RPS起点归一` 相同的时间范围与自定义提交。
  - `原始视图`不显示时间范围控件。
- 图表口径：
  - `score` 视图下 `Y=0` 基线可见，曲线围绕 0 上下波动。
  - hover 正常显示 Score 数值与日期。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx` 与 `RpsStyleChart.tsx` 诊断无新增错误。
