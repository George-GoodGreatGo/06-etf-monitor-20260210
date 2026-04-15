# 计划：RPS 图表加载态与交互锁定

## 1. Summary
- 为 RPS 模块新增“图表加载态”：当用户切换视图或提交日期范围触发请求时，图表区域显示明确 loading 覆盖层。
- 在 loading 期间禁止再次切换视图/时间范围/提交日期，避免并发请求与状态错乱。
- 保持现有 `DataStatusBanner` 机制不变，新增的是图表局部体验与控件交互锁定。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx` 已有 `loading` 状态，且每次请求前 `setLoading(true)`，请求完成后 `setLoading(false)`。
- 当前控件（视图切换按钮、时间范围按钮、日期输入、提交按钮）没有根据 `loading` 统一禁用，用户可在加载期间重复触发交互。
- `src/components/charts/RpsStyleChart.tsx` 当前无 `loading` 入参，也没有覆盖层/骨架屏/spinner 展示。
- 现有流程存在风险：加载中多次切换会导致用户感知混乱（尤其是 custom 提交与视图切换叠加时）。

## 3. Proposed Changes

### 3.1 Panel：统一交互禁用状态
- 修改文件：`src/components/RpsStylePanel.tsx`
- 新增派生状态：`const controlsDisabled = loading`。
- 将以下控件统一绑定 `disabled={controlsDisabled}`：
  - 视图切换按钮（相对/原始）
  - 相对视图时间范围按钮组
  - 自定义日期输入框
  - 自定义日期“提交”按钮
- 禁用样式统一处理：
  - 加 `disabled:opacity-50 disabled:cursor-not-allowed`（或等价 class）
  - 取消 hover 强调，避免误导用户可操作。

### 3.2 Panel：图表区域 loading 遮罩
- 修改文件：`src/components/RpsStylePanel.tsx`
- 在 `RpsStyleChart` 外层包裹相对定位容器，并在 `loading===true` 时显示遮罩层：
  - 半透明背景 + spinner + 文案（如“正在加载图表数据...”）
  - 遮罩覆盖图表交互区，阻止鼠标事件继续操作图表。
- 该遮罩仅覆盖图表部分，不影响上方状态卡与 DataStatusBanner 的信息展示。

### 3.3 Chart：接收 loading 入参（可选增强）
- 修改文件：`src/components/charts/RpsStyleChart.tsx`（可选）
- 增加 `loading?: boolean` 入参，用于内部控制：
  - loading 时可选择隐藏 hover tips，避免旧数据 tooltip 干扰；
  - 或在 loading 时短路 crosshair 更新（减少无意义 re-render）。
- 若不在图表组件内处理，也可由 Panel 外层遮罩完成（优先简单稳定方案）。

### 3.4 触发场景覆盖
- 变更后，以下场景都会进入 loading 且交互锁定：
  - 切换 `raw/relative` 视图
  - 相对视图切换预设时间范围
  - 相对视图提交自定义起点日期
- 原始视图下本就不展示时间范围控件，逻辑保持不变。

## 4. Assumptions & Decisions
- “不允许 loading 过程中再次切换日期或视图”按**前端禁用控件 + 图表遮罩阻断**实现，无需后端改动。
- 采用最小侵入方案：复用现有 `loading` 状态，不新增复杂请求队列或全局锁。
- loading 结束后自动恢复控件可用，不增加额外确认步骤。

## 5. Verification Steps
- 交互验证：
  - 触发请求后，视图按钮/时间范围按钮/日期输入/提交按钮全部不可点击。
  - loading 遮罩出现且覆盖图表区域，图表拖拽缩放不可操作。
  - 请求结束后，遮罩消失，控件恢复可操作。
- 场景验证：
  - 切换视图时生效。
  - 相对视图选择预设范围时生效。
  - 自定义日期点击提交时生效。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx`（及若改动则 `RpsStyleChart.tsx`）无新增诊断错误。
