# 计划：Score 视图拖拽锁定 Y 轴尺度

## 1. Summary
- 针对 `MA50归一视图（Score走势）`，在拖拽图表时不再改变 Y 轴尺度，避免上下尺度跳变。
- 参考“低波机会”实践，采用“固定价格轴范围（核心）+ 必要时限制缩放入口（兜底）”的组合方式实现稳定展示。
- 保持 X 轴在数据范围内可拖拽/缩放查看历史，不引入空白区。

## 2. Current State Analysis
- `src/components/charts/RpsStyleChart.tsx`
  - 当前全视图统一配置：`handleScale.mouseWheel=true`、`axisPressedMouseMove=true`。
  - `score` 视图下，Y 轴会随“可视范围变化的自动缩放（autoscale）”而变化：同一组数据在不同时间窗口的波动区间不同，导致用户左右拖拽（改变可视时间窗）时 Y 轴刻度持续跳变。
  - 当前 `score` 主线 series 未配置 `autoscaleInfoProvider`，因此 price scale 会按可视区域内数据 min/max 动态 autoscale。
- `src/components/charts/LowVolOpportunityChart.tsx`
  - 通过关闭 `handleScale` 中会引发尺度变换的能力（如 `mouseWheel/pinch`）并结合固定分位轴范围（`autoscaleInfoProvider`）稳定视觉。
  - 核心经验：对“分析阈值型”副图，价格轴应保持稳定刻度。

## 3. Proposed Changes

### 3.1 Score 视图专用交互配置
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动点：
  - 将交互配置拆分为按视图控制（不再全视图共用同一 `handleScale`）。
  - 在 `viewMode==='score'` 时：
    - 仅保留必要的“时间轴浏览”入口：拖拽平移（pan）与时间缩放（zoom）。
    - 视情况禁用 `axisPressedMouseMove`：用于避免用户在 Y 轴上“手动缩放”改变尺度（与“Y轴锁定”的目标相违背）。
    - 不改动 `lockEdges` 机制，仍不允许拖拽到两侧空白区。
  - `raw/relative` 保持现有交互不变。

### 3.2 固定 score 视图价格轴范围
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动点：
  - 为 `score` 视图的“Score 主线”添加 `autoscaleInfoProvider`，让 price scale 的 autoscale 始终返回同一个固定 `priceRange`，从根源上消除“拖拽导致的 Y 轴跳变”。
  - 固定范围计算口径（必须与阈值背景带一致）：
    - 使用当前 `prepared.scoreRange`（已在 `useMemo` 中按全部 score 数据计算 min/max）。
    - 取 `lower = min(-20, scoreMin) - 10`，`upper = max(20, scoreMax) + 10`。
    - 这样既确保阈值带 `[-20,20]` 始终完整可见，也确保极端值不会被裁切；并且该范围对“左右拖拽改变可视时间窗”保持不变。
  - 兜底策略：
    - 若 `prepared.scoreRange` 不存在（无有效 score 数据），使用保守固定范围，例如 `[-30, 30]`，避免空/异常时抖动。
  - 适用范围：
    - 仅在 `viewMode==='score'` 时启用固定范围；`raw/relative` 继续采用默认 autoscale（随可视范围变化）。

### 3.3 保留时间边界约束
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 维持现有：
  - `fixLeftEdge/fixRightEdge/rightOffset` 与可见范围限制；
  - 不允许拖拽出数据区间外空白。
- 说明：
  - 本次仅控制 `score` 视图的 Y 轴尺度稳定，不改变 X 轴边界策略。

## 4. Assumptions & Decisions
- 仅针对 `score` 视图锁定 Y 轴尺度；`raw/relative` 继续沿用当前交互。
- “锁定”定义为：在 `score` 视图中，用户左右拖拽（平移时间窗）或时间缩放时，Y 轴刻度不随可视窗口变化而变动（即固定 `priceRange`）。
- 不改后端与数据结构，纯前端图表层改造。
- 若用户通过“指标控制项”切换 ticker 开关导致 `prepared.scoreRange` 变化，允许重新计算并更新一次固定范围（属于显式变更，不属于“拖拽导致的跳变”）。

## 5. Verification Steps
- 行为验证：
  - 在 `score` 视图中左右拖拽图表（平移可视时间窗），Y 轴刻度保持稳定不跳变。
  - 在 `score` 视图中进行时间缩放（鼠标滚轮/触控板缩放/触屏 pinch，取决于当前已开放的交互），Y 轴刻度仍保持稳定。
  - X 轴仍可在有数据范围内自由浏览，且两侧不出现空白区。
- 边界验证：
  - 左右不出现空白区，仍受数据边界约束。
- 回归验证：
  - `raw/relative` 视图交互保持原行为。
  - `score` 的阈值背景带、Y=0 基线、hover 提示均正常。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStyleChart.tsx` 无新增诊断错误。
