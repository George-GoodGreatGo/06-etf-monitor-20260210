# 计划：RPS 三视图指标控制与轴拖拽缩放

## 1. Summary
- 为 `原始视图 / RPS起点归一视图 / MA50归一视图` 统一新增“图表指标控制项”，按你的决策采用 **按 Ticker 开关**。
- 图表交互新增“在 X 轴 / Y 轴处拖拽缩放”，并保留现有滚轮缩放。
- 缩放范围仍受所选时间区间限制：不会超出当前已加载的数据起止边界（与现有 lockEdges 约束一致）。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx`
  - 已支持 3 视图（`raw/relative/score`）与统一时间区间（`raw` 除外）。
  - 当前没有“按 Ticker 显隐”控制项。
- `src/components/charts/RpsStyleChart.tsx`
  - 现有 `viewMode` 三态渲染已完成，`lockEdges` 可限制左右空白。
  - 当前 `handleScale` 配置为 `mouseWheel: true, axisPressedMouseMove: false`，不支持轴拖拽缩放。
  - 图例显示所有 ticker，但不能交互开关。
- 参考实现 `LowVolOpportunityChart.tsx`
  - 有“控制按钮 + 多线显示切换”的交互模式。
  - 多图联动通过 `timeScale().setVisibleLogicalRange(...)` 保持一致范围。

## 3. Proposed Changes

### 3.1 Panel：新增按 Ticker 控制项
- 修改文件：`src/components/RpsStylePanel.tsx`
- 新增状态：
  - `enabledTickers: Record<string, boolean>`（从当前矩阵 tickers 初始化为全开）
- 新增控制区（放在“图表视图”与“时间范围”同区域）：
  - 每个 ticker 一个按钮（显示 `代码 + 中文名`）
  - 开启态/关闭态样式区分，行为参考低波模块按钮风格
  - loading 时继续受 `controlsDisabled` 禁用
- 向图表组件透传：
  - `enabledTickers`

### 3.2 Chart：按 Ticker 开关过滤三视图线条
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- `Props` 扩展：
  - `enabledTickers?: Record<string, boolean>`
- 数据准备逻辑：
  - 在 `prepared` 计算时，仅对 `enabledTickers[ticker] !== false` 的 ticker 构建线条与 hover 数据。
  - 三视图统一生效（`raw/relative/score`）。
- 细节约束：
  - 若全部 ticker 关闭，图表展示空态提示（例如“请至少选择一个指数”），且不报错。
  - 参考线仍保留（`relative: y=1`, `score: y=0`）。

### 3.3 Chart：新增轴拖拽缩放（保留滚轮）
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 图表交互配置调整：
  - `handleScale.mouseWheel = true`（保持）
  - `handleScale.axisPressedMouseMove = true`
  - `handleScale.pinch = true`（可选，提升触控体验）
- 保持边界约束：
  - 继续使用 `timeScale.fixLeftEdge = true`、`fixRightEdge = true`、`rightOffset = 0`
  - 继续在数据变更后显式设置可见范围到数据边界，确保不会拖出空白。

### 3.4 时间区间限制一致性
- 逻辑说明（无需后端改动）：
  - `relative/score` 已按区间请求后端数据，天然受所选区间限制。
  - `raw` 为全历史，不受区间按钮限制，但仍受“已加载数据边界”限制（不能拖出空白）。

## 4. Assumptions & Decisions
- 已确认：控制项采用 **按 Ticker 开关**，不做“按指标线开关”。
- 已确认：缩放交互采用 **保留滚轮 + 新增轴拖拽**。
- 不修改后端 API；全部在前端完成（数据结构已含所需字段）。

## 5. Verification Steps
- 功能验证：
  - 三视图都出现 ticker 控制项，点按可实时隐藏/显示对应指数曲线。
  - 关闭某 ticker 后，hover 与图例同步反映（不再显示该 ticker 数据）。
  - 全部关闭时显示空态提示，不抛异常。
- 交互验证：
  - 在 X 轴拖拽可缩放时间范围；在 Y 轴拖拽可缩放数值范围。
  - 滚轮缩放保持可用。
  - 任意缩放/拖拽下，左右不出现空白区域。
- 区间验证：
  - `RPS起点归一` 与 `MA50归一` 仍遵循所选时间区间。
  - `原始视图`仍是全历史边界。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx` 与 `RpsStyleChart.tsx` 无新增诊断错误。
