# 计划：将“相对视图”重命名为“起点视图”

## 1. Summary
- 将 RPS 模块里所有面向用户展示的“相对视图”文案统一改为“起点视图”。
- 仅改展示文案，不改内部逻辑与接口字段（内部 `viewMode='relative'` 保持不变，避免引发连锁改动）。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx` 中存在以下“相对视图”展示：
  - 说明文案：`相对视图：按所选起点...`
  - 视图切换按钮：`相对视图`
  - 条件渲染逻辑仍基于 `chartView === 'relative'`（这是内部状态，不应随文案变更）
- `src/components/charts/RpsStyleChart.tsx` 中存在以下“相对视图”展示：
  - 图例说明：`归一化RPS 实线 / 归一化MA50 虚线`（未包含“相对视图”字样，可保留）
  - 参考线文本与 hover 文案无“相对视图”字样（可不改）
- 结论：本次改动主要集中在 `RpsStylePanel.tsx` 的用户可见标签与描述。

## 3. Proposed Changes

### 3.1 统一文案替换
- 修改文件：`src/components/RpsStylePanel.tsx`
- 替换项：
  - 说明文案中 `相对视图` -> `起点视图`
  - 视图切换按钮文本 `相对视图` -> `起点视图`
- 保持不变：
  - `type RpsViewMode = 'raw' | 'relative'`
  - 所有 `chartView === 'relative'` 条件分支
  - API 查询参数与后端数据结构

### 3.2 可选一致性检查
- 检查同模块是否还有“相对视图”遗留文案（如 tooltip、注释、空状态说明）；仅替换用户可见文本。
- 不改历史计划文档与代码注释中的旧词，避免无意义噪音提交。

## 4. Assumptions & Decisions
- 本次需求是“UI命名优化”，不是“状态枚举重命名”。
- 以最小风险原则执行：只改用户可见文案，避免影响现有已稳定功能。

## 5. Verification Steps
- 页面验证：
  - RPS 视图切换按钮显示“起点视图 / 原始视图”。
  - 说明文案中出现“起点视图”，不再出现“相对视图”。
- 回归验证：
  - 选择“起点视图”后仍按原先相对归一化逻辑渲染。
  - 时间范围、自定义起点、加载锁定行为保持正常。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStylePanel.tsx` 诊断无新增错误。
