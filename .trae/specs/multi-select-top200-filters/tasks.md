# Tasks

- [x] Task 1: 筛选值类型定义与匹配函数改造（top200SignalFilters.ts）
  - [x] `Top200SignalFilterValue` 从 `string` 改为 `readonly string[]`
  - [x] `Top200FreshnessFilterValue` 从 `'all' | 'none' | MomentumSignalFreshnessBucket` 改为 `readonly string[]`
  - [x] `Top200ZFilterValue` 从 `'all' | 'z_ge_258' | ...` 改为 `readonly string[]`
  - [x] `matchesSignalFilter(row, strategyId, values: readonly string[])` 空数组→返回 true；非空→signalKey 在数组中
  - [x] `matchesFreshnessFilter(row, strategyId, values: readonly string[])` 空数组→返回 true；非空→freshnessBucket 在数组中；'none' → 无信号
  - [x] `matchesZFilter(row, values: readonly string[])` 空数组→返回 true；非空→任一区间满足即 true

- [x] Task 2: Top100FilterBar 多选 Tag Selector UI 改造
  - [x] Props 类型：`selectedSignal` → `readonly string[]`，`onChangeSignal` → `(v: string[]) => void`，同 freshness/z
  - [x] 将 3 个 `<select>` 替换为内联 tag 组：每个选项一个 `<button>`，选中时高亮，点击切换
  - [x] "全部"语义通过选中数组为空实现：当所有 tag 都取消时传入空数组
  - [x] Tag 样式：默认 `border-white/10 bg-white/5 text-[#94A3B8]`，选中 `border-[#FF5722] bg-[rgba(255,87,34,0.15)] text-white`
  - [x] 布局与原版保持一致，tag 组水平排列

- [x] Task 3: Home.tsx 状态层适配
  - [x] `selectedSignalFilter` 初始值从 `'all'` 改为 `[]`
  - [x] `selectedFreshnessFilter` 初始值从 `'all'` 改为 `[]`
  - [x] `selectedZFilter` 初始值从 `'all'` 改为 `[]`
  - [x] 切换策略时清空信号筛选改为 `setSelectedSignalFilter([])`
  - [x] `onReset` 将三个筛选重置为 `[]`
  - [x] 信号选项变化的 `useEffect` 调整：从检查 `selectedSignalFilter === 'all'` 改为 `selectedSignalFilter.length === 0`
  - [x] Top100FilterBar 的 props 更新为数组类型和回调

- [x] Task 4: 回归验证
  - [x] `npm run check`（tsc typecheck）通过，无新增告警
  - [x] `npm run build` 构建成功

# Task Dependencies
- Task 1 是 Task 2 和 Task 3 的前置依赖（类型定义先行）
- Task 2 和 Task 3 可并行执行（两者均依赖 Task 1 完成）
- Task 4 依赖 Task 1–3 全部完成
