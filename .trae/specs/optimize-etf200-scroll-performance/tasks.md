# Tasks
- [x] Task 1: 将 Top100Table 的 sortRows 调用用 useMemo 包裹
  - 在 Top100Table 组件内，将 `const data = sortRows(rows, sortKey, sortDir)` 替换为 `const data = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])`
  - 需要在文件顶部 import 中添加 `useMemo`
  - 用浏览器 DevTools React Profiler 验证：当 debouncedKeyword 变化触发父组件重渲染时，Top100Table 的 sortRows 不再被重新调用（或调用次数减少）

- [x] Task 2: 用 React.memo 包裹 Top100Table 组件
  - 将 `export default function Top100Table(...)` 改为用 `React.memo` 包裹
  - 需要 import `memo` from react，将默认导出改为 `export default memo(function Top100Table(...){...})`
  - 用浏览器 DevTools React Profiler 验证：当父组件中与 Top100Table props 无关的状态变化时，Top100Table 不再重渲染

# Task Dependencies
- Task 1 和 Task 2 相互独立，可并行实施
