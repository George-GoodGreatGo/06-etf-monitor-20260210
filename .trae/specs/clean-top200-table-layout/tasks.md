# Tasks

- [x] Task 1: Top100Table.tsx — 取消斑马纹
  - [x] 数据行 `<tr>` 的 `cn()` 调用中移除 `even:bg-[rgba(255,255,255,0.02)]`

- [x] Task 2: Top100Table.tsx — 表头禁止换行
  - [x] `<thead>` 添加 `whitespace-nowrap`

- [x] Task 3: Top100Table.tsx — 操作按钮禁止换行
  - [x] `actionButtonClassName` 中添加 `whitespace-nowrap`

- [x] Task 4: 回归验证
  - [x] `npm run check`（tsc typecheck）通过，无新增告警
  - [x] `npm run build` 构建成功

# Task Dependencies
- Task 1–3 互相独立，可同时实施
- Task 4 依赖 Task 1–3 全部完成
