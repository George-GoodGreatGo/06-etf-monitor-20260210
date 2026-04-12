# Tasks
- [x] Task 1: 固定贴边布局（桌面端）
  - [x] 将 AppShell 的侧边栏改为 `fixed left-0 top-0 h-screen`，内容区增加左侧 padding/offset
  - [x] 确保内容区可滚动且最大宽度与现有视觉体系一致

- [x] Task 2: SideNav 交互状态与微动效
  - [x] 导航项增加 hover/active/focus-visible 的一致样式与过渡动画
  - [x] active 指示器（圆点/边条）增加平滑过渡（避免跳变）
  - [x] 分组/间距调整，使信息层级更清晰

- [x] Task 3: 移动端抽屉（最小实现）
  - [x] NavBar 增加移动端“菜单”按钮（仅小屏显示）
  - [x] AppShell 管理抽屉开关状态，提供遮罩与滑入/滑出动画
  - [x] 支持：点击遮罩关闭、ESC 关闭、点击导航自动关闭

- [x] Task 4: 回归与验收
  - [x] 桌面端滚动时左侧导航固定贴边
  - [x] 交互状态与动效可见且不干扰操作
  - [x] 移动端抽屉打开/关闭符合预期
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
