# 计划：流动性分位“样本不足”改为仅在 hover 区间显示

## 1. Summary
- 目标：将“独家流动性指数（5年分位）”副图标题中的“样本不足”提示，从“全局固定显示”改为“仅当 hover 到样本不足区间时显示”。
- 范围：仅调整前端显示逻辑，不修改后端数据、不修改分位计算口径、不修改图表数据线。

## 2. Current State Analysis
- 当前实现文件：`src/components/charts/MarketLiquidityChart.tsx`。
- 现状逻辑：
  - 在 `useMemo(data)` 内通过 `v5Pct.length < 630` 计算全局布尔 `hasSampleInsufficient`。
  - 在副图标题处直接使用 `data.hasSampleInsufficient ? ' · 样本不足' : ''` 渲染。
- 结果表现：
  - 即使当前 hover 日期对应的 `v5Pct` 已有值，标题仍可能长期显示“样本不足”，造成理解偏差。

## 3. Proposed Changes

### A. 引入“按日期”样本不足映射
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 变更：
  - 在 `useMemo(data)` 中新增 `v5PctSampleInsufficientByTime`（`Map<UTCTimestamp, boolean>`）。
  - 遍历 `series` 时按时间顺序累计 `v5Pct` 有效点计数；在每个日期写入“截至该日期是否 `<630`”。
  - 保留现有图线与 `hover.map` 结构，不改变数据绘制。
- 原因：
  - 将“样本不足”判定从全局改为“时间点相关”，支持按 hover 精确展示。

### B. 标题提示改为“仅 hover 区间显示”
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 变更：
  - 新增派生布尔（例如 `showHoverSampleInsufficient`）：
    - 仅当 `hover` 存在；
    - 且 `hover.t` 在 `v5PctSampleInsufficientByTime` 中判定为 `true`；
    - 才在副图标题拼接 ` · 样本不足`。
  - 无 hover 或 hover 落在样本充足区间时，不显示该标记。
- 原因：
  - 严格符合需求“仅在 hover 到样本不足区间时显示”。

### C. 清理旧的全局样本不足字段引用
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 变更：
  - 移除（或不再使用）`data.hasSampleInsufficient`。
  - 保证组件内不再存在全局常驻提示触发点。
- 原因：
  - 避免新旧逻辑并存导致误判。

## 4. Assumptions & Decisions
- 已确认需求：
  - 仅在 hover 到样本不足区间时展示“样本不足”。
- 决策：
  - 样本不足阈值沿用当前 5 年分位阈值 `<630`。
  - 提示展示位置保持在“副图标题”不变，仅改变触发条件。
- 不变项：
  - 分位口径（5年）、阈值线（20/80）、后端写入与回灌逻辑均不改。

## 5. Verification Steps
- 静态验证：
  - 运行 `npm run check`，确保类型与编译通过。
- 交互验证：
  - 不移动鼠标（无 hover）时，副图标题不显示“样本不足”。
  - hover 到历史前段（样本不足区间）时，标题出现“·样本不足”。
  - hover 到样本充足区间时，标题自动消失。
- 回归验证：
  - `v5Pct` 曲线、20/80 阈值线、hover 数值显示保持原有行为。
