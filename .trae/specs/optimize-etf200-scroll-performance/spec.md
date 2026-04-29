# ETF200 列表滚动性能优化 Spec

## Why
ETF200 列表（200行 × 12列 = 2400个DOM节点始终挂载）在滚动时出现明显卡顿。分析发现三个核心瓶颈：每次渲染都在 render 阶段执行 O(n log n) 排序、表格组件缺少 React.memo 保护、200 行全部直接渲染到 DOM 无虚拟化。本 Spec 以最小必要原则，优先采用低成本高收益的优化。

## What Changes
- Top100Table 中 `sortRows()` 改用 `useMemo` 包裹，避免每次无关渲染都重新排序
- Top100Table 用 `React.memo` 包裹，避免父组件无关状态变化导致重渲染

## Impact
- Affected specs: 无（纯性能优化，不改变功能行为）
- Affected code: `src/components/Top100Table.tsx`

## MODIFIED Requirements
### Requirement: ETF200 Table Rendering
Top100Table 组件 SHALL 在排序参数未变化时复用上次排序结果，避免在 React render 阶段重复执行 O(n log n) 排序。

#### Scenario: 滚动或其他无关状态变化时不再重排序
- **WHEN** 父组件中与排序无关的状态发生变化（如关键词输入中）
- **THEN** sortRows 不应被重新执行
- **AND** 表格渲染性能应显著改善

#### Scenario: 排序参数变化时正常重排
- **WHEN** 用户点击排序表头切换排序键或排序方向
- **THEN** sortRows 应被重新执行并返回新的排序结果

### Requirement: Top100Table Memoization
Top100Table 组件 SHALL 在 props 未发生变化时跳过重渲染，避免父组件中不相关状态变化导致的级联渲染。

#### Scenario: 父组件无关状态变化
- **WHEN** 父组件中与 Top100Table props 无关的状态发生变化
- **THEN** Top100Table 不应重新渲染

#### Scenario: 表格数据变化时正常更新
- **WHEN** rows、sortKey、sortDir 或其他 props 变化
- **THEN** Top100Table 应正常重新渲染
