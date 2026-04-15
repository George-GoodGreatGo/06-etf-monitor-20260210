# 计划：RPS 视图默认与边界交互优化

## 1. Summary
- 调整默认入口为：**相对视图 + 最近1年**，并将按钮顺序调整为“相对视图在前、原始视图在后”。
- 自定义起点交互改为：点击日期输入框弹出日期选择器，输入框右侧新增“提交”按钮，只有点击提交才触发查询。
- 原始视图不提供时间范围选择，默认加载历史全量数据（startDate/endDate 不下发）。
- 两种视图都改为“左右边界锁定”：左边固定最早可见数据点（相对=所选起点；原始=最早历史点），右边固定最新数据点；拖拽/缩放不允许出现左右空白无数据区域。
- 折线图高度从当前 `360px` 提升为 `540px`（1.5 倍）。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx`
  - 当前默认是 `chartView='relative'` + `rangeKey='3m'`。
  - 当前“时间范围”在原始/相对视图都显示，并且切换即自动请求。
  - 当前 `custom` 日期输入是即时生效（`onChange` 直接参与 `resolvedRange`，触发请求）。
  - 当前请求无视图分流：始终按 `resolvedRange` 下发 `startDate/endDate`。
- `src/components/charts/RpsStyleChart.tsx`
  - 当前有 `raw/relative` 双视图与相对视图归一化、`y=1` 参考线。
  - 当前每次数据变更后执行 `fitContent()`，但未显式锁定 timeScale 边界；拖拽可能出现空白。
  - 图表高度是 `h-[360px]`。

## 3. Proposed Changes

### 3.1 Panel：默认值与控件可见性
- 修改文件：`src/components/RpsStylePanel.tsx`
- 变更点：
  - 默认 `rangeKey` 由 `3m` 改为 `1y`。
  - 视图按钮顺序改为：`相对视图`（第1位） -> `原始视图`（第2位）。
  - 当 `chartView==='raw'` 时，隐藏整组“时间范围”控件与“当前范围”文案。
  - 当 `chartView==='relative'` 时，显示时间范围控件。

### 3.2 Panel：自定义日期“提交制”交互
- 修改文件：`src/components/RpsStylePanel.tsx`
- 新增状态：
  - `customStartDateDraft`：输入框临时值（仅编辑态）。
  - `customStartDateApplied`：已提交值（参与请求计算）。
- 交互规则：
  - 选择 `rangeKey='custom'` 时展示：日期输入框 + `提交`按钮。
  - 输入日期仅更新 `Draft`，不触发数据请求。
  - 点击 `提交` 后把 `Draft` 写入 `Applied`，才触发请求。
  - 若 `Draft` 为空或晚于今天，提交时自动 clamp 到合法日期（不抛错）。

### 3.3 Panel：按视图分流请求参数
- 修改文件：`src/components/RpsStylePanel.tsx`
- 取数规则：
  - `relative`：按当前选项下发 `startDate/endDate`。
  - `raw`：不下发 `startDate/endDate`，让后端返回历史全量。
- `useEffect` 依赖：
  - `raw` 模式下不因 `rangeKey/custom*` 变化触发重拉；
  - `relative` 模式下仅在范围真正“已生效”后触发重拉。

### 3.4 Chart：边界锁定与空白禁止
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改造要点：
  - 新增 props：`lockEdges?: boolean`（默认 true）。
  - chart 初始化时设置：
    - `timeScale.fixLeftEdge = true`
    - `timeScale.fixRightEdge = true`
    - `timeScale.rightOffset = 0`
    - `timeScale.minBarSpacing` 给合理值，避免过度缩放带来视觉空白
    - `handleScale.axisPressedMouseMove = false`（限制通过轴拖出空白）
  - 数据更新时不再仅 `fitContent()`；改为根据当前 prepared 数据计算最小/最大 logical range，并显式 `setVisibleLogicalRange({from,to})`，确保左右边界始终贴合数据区间。
  - 保留相对视图 `y=1` 参考线逻辑不变。

### 3.5 Chart：高度提升 1.5 倍
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 将容器高度从 `h-[360px]` 调整为 `h-[540px]`。

## 4. Assumptions & Decisions
- 采用“原始视图=全历史固定口径”，不再给原始视图提供时间范围开关。
- 相对视图时间范围仍支持全部预设 + 自定义，但自定义仅在用户点击“提交”后生效。
- “禁止空白区”以 lightweight-charts 的时间轴边界锁定 + 显式可见范围控制实现，不做自定义拖拽拦截器。

## 5. Verification Steps
- 默认行为：
  - 首次进入应为“相对视图 + 最近1年”，且视图按钮顺序正确。
- 自定义日期：
  - 选择“自定义起点日期”后仅编辑输入不请求；点击“提交”才请求并刷新图。
- 视图规则：
  - 原始视图不显示时间范围控件，图上为全历史数据。
  - 相对视图显示时间范围控件，并按所选范围查询。
- 边界与拖拽：
  - 原始/相对视图左右拖拽时，左侧不越过首个数据点、右侧不越过最新数据点，不出现空白区。
- 视觉：
  - 图表高度确认为 540px。
- 工程：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx` 与 `RpsStyleChart.tsx` 诊断无新增错误。
