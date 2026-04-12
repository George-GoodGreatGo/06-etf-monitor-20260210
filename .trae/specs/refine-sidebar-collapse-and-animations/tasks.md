# Tasks
- [x] Task 1: 顶部状态栏对齐优化（桌面端）
  - [x] 顶部栏为固定侧栏预留宽度，并保证 Logo/控件与内容区起始位置对齐
  - [x] 折叠态/展开态下对齐一致（随侧栏宽度联动）

- [x] Task 2: 左侧导航折叠/展开
  - [x] 增加折叠按钮（桌面端可见），实现宽度过渡动画
  - [x] 折叠态：仅显示图标；展开态：图标 + 文案
  - [x] localStorage 持久化折叠状态

- [x] Task 3: 导航 active 动效优化（更“高级”）
  - [x] 引入 active 指示器层（背景胶囊/边条），在导航切换时平滑移动（150–250ms）
  - [x] 保持 hover/pressed/focus-visible 细节，但避免突兀跳变

- [x] Task 4: 回归与验收
  - [x] Logo 不再与侧栏产生不美观对齐；整体对齐自然
  - [x] 点击导航时 active 动效平滑不突兀
  - [x] 侧栏可折叠且状态可记忆；折叠态可用性（title/aria）完备
  - [x] `npm run check` 通过

# Task Dependencies
- Task 1 depends on Task 2
- Task 3 depends on Task 2
- Task 4 depends on Task 1-3
