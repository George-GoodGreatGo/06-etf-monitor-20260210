# Tasks

- [ ] Task 1: Top100FilterBar.tsx — 字体放大 + 对齐调优 + 重置按钮不换行
  - [ ] Tag 按钮：`text-[11px]` → `text-xs`，`px-2.5 py-1` → `px-3 py-1.5`
  - [ ] Group label：`text-xs` → `text-sm`，增加 `w-10 shrink-0` 统一宽度实现垂直对齐
  - [ ] Tag 容器：将 gap 从 `1.5` 调为 `2`，保持每组之间统一间距
  - [ ] 外层容器：用 `gap-2.5` 替代 `gap-2`，让各组视觉上更分明
  - [ ] 重置按钮：添加 `whitespace-nowrap`

- [ ] Task 2: 回归验证
  - [ ] `npm run check` 通过，无新增告警
  - [ ] `npm run build` 构建成功

# Task Dependencies
- Task 2 依赖 Task 1 完成
