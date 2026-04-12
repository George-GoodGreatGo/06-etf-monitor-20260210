# Tasks
- [x] Task 1: 移除侧栏品牌区
  - [x] 删除 SideNav 顶部的站点 Logo/品牌名块
  - [x] 保持导航分组与导航项布局不塌陷

- [x] Task 2: 顶部品牌与侧栏图标对齐
  - [x] 调整 NavBar 左侧内边距，使顶部品牌左边缘与侧栏导航项图标左边缘对齐
  - [x] 折叠/展开时仍保持对齐（必要时提取共享对齐基准）

- [x] Task 3: 折叠态图标左对齐
  - [x] 折叠态下导航项不再居中图标，保持图标起始位置与展开态一致
  - [x] 保持可访问性（title/aria-label）与 focus-visible 样式不退化

- [x] Task 4: 回归与验收
  - [x] 左侧导航不再显示品牌区
  - [x] 顶部品牌与侧栏图标对齐（展开/折叠均成立）
  - [x] `npm run check` 通过

# Task Dependencies
- Task 4 depends on Task 1-3
