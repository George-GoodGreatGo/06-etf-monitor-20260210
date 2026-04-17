# Tasks
- [x] Task 1: 梳理并统一侧边栏导航交互状态规范
  - [x] 明确 `hover`、`pressed`、`active`、`focus-visible` 的目标视觉与优先级
  - [x] 明确禁止项：点击过程不得出现白色高亮边框/闪烁

- [x] Task 2: 实现导航项点击与焦点样式优化
  - [x] 移除或覆盖会触发白色边框的默认样式（含 outline/ring 暴露路径）
  - [x] 实现平滑过渡的点击反馈与 active 指示器联动
  - [x] 保留键盘可访问焦点可见性，并改为柔和且一致的 focus-visible 样式

- [x] Task 3: 保证桌面侧栏与移动端抽屉体验一致
  - [x] 复用同一套导航项状态样式，避免双份逻辑漂移
  - [x] 验证抽屉场景下点击/切换无白边高亮

- [x] Task 4: 回归验证与验收
  - [x] 手动验证鼠标点击、键盘 Tab 导航、多次快速切换的观感
  - [x] 运行项目既有检查命令（如 `npm run check`）确保无回归

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2-3
