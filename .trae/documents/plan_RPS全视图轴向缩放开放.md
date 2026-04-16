# 计划：RPS全视图开放X/Y轴缩放

## 1. Summary
- 目标：在 `RPS` 模块的三个视图（`raw`、`relative`、`score`）统一支持基于轴的缩放交互，允许用户通过 X 轴与 Y 轴进行日期/数值范围放大缩小。
- 范围：仅改前端图表交互层（`RpsStyleChart.tsx`），不改后端、不改接口结构。
- 关键决策：按用户确认，`score` 视图也开放 X+Y 轴缩放，并取消此前“Y轴固定不跳变”的限制。

## 2. Current State Analysis
- 文件：`src/components/charts/RpsStyleChart.tsx`
  - 当前 `createChart` 初始配置里 `handleScale` 为全局开启：`mouseWheel: true`、`axisPressedMouseMove: true`、`pinch: true`。
  - 另有按视图二次覆盖逻辑：`viewMode==='score'` 时将 `axisPressedMouseMove` 设为 `false`，导致 score 不能按轴缩放。
  - `score` 主线当前配置了 `autoscaleInfoProvider + 固定priceRange`（`scoreFixedRange`），这会锁定 Y 轴范围，与“允许Y轴缩放”冲突。
  - 图表仍维持 `fixLeftEdge/fixRightEdge/rightOffset`，用于防止左右空白区，符合既有边界约束。
- 参考实现：`src/components/charts/LowVolOpportunityChart.tsx`
  - 该模块主要采用主图拖拽平移与同步机制；本需求沿用“图表交互集中在 chart options 层统一控制”的方式，不改业务数据处理链路。

## 3. Proposed Changes

### 3.1 统一三视图轴向缩放开关
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动内容：
  - 移除按 `viewMode` 区分 `handleScale` 的二次覆盖逻辑（当前 score 特殊分支）。
  - 统一为三视图一致口径：支持 `axisPressedMouseMove`（轴拖拽缩放）、`mouseWheel`（滚轮缩放）、`pinch`（触控缩放）。
- 目的：
  - 保证 `raw/relative/score` 三视图在 X/Y 轴缩放能力上行为一致。

### 3.2 解除score视图Y轴固定范围
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动内容：
  - 移除 `scoreFixedRange` 相关计算与依赖（`useMemo`）。
  - 移除 `score` 主线 `autoscaleInfoProvider` 固定 `priceRange` 配置，恢复默认 autoscale。
- 目的：
  - 让 `score` 视图的 Y 轴可被用户主动缩放（与用户最新决策一致）。

### 3.3 保留边界与既有交互
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 保留内容：
  - `lockEdges` 及 `timeScale.fixLeftEdge/fixRightEdge/rightOffset` 逻辑不变。
  - `score` 视图默认最近2年可见范围、不显示时间筛选（由上层Panel控制）不变。
  - 阈值背景带、Y=0参考线、hover tips、ticker显隐不变。
- 目的：
  - 仅调整“轴向缩放能力”，不引入其它行为回归。

## 4. Assumptions & Decisions
- 已确认采用：`score` 视图也开放 X+Y 缩放，覆盖此前“score锁Y”策略。
- “允许对hoverX轴、Y轴放大缩小”的实现口径：以 lightweight-charts 的轴拖拽缩放与滚轮/触控缩放为准。
- 不新增 UI 控件或文案提示；保持现有界面结构。

## 5. Verification Steps
- 功能验证：
  - 在 `raw` 视图：可通过 X/Y 轴进行放大缩小。
  - 在 `relative` 视图：可通过 X/Y 轴进行放大缩小。
  - 在 `score` 视图：可通过 X/Y 轴进行放大缩小（确认已不再锁Y）。
- 回归验证：
  - 三视图左右边界仍不出现空白区。
  - `score` 阈值背景带、Y=0线、hover提示正常显示。
  - ticker 全关空态提示逻辑不受影响。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStyleChart.tsx` 无新增诊断错误。
