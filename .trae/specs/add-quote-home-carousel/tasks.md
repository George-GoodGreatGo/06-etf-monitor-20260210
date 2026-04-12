# Tasks
- [x] Task 1: 语录数据与呈现组件
  - [x] 建立语录数据结构（包含 author/中英文/source），内置不少于 9 条（3 位作者各 ≥ 3 条）
  - [x] 实现轮播组件：自动轮播、暂停/播放、上一条/下一条、指示点
  - [x] 动效实现不引入新库（CSS transition），避免突兀跳变

- [x] Task 2: 新增首页页面与版面设计
  - [x] 新增首页页面（暗色设计、留白与层次）
  - [x] 语录卡片支持长文折行与不同屏宽自适应
  - [x] 作者与出处展示清晰，强调“理性/耐心/风险”导向

- [x] Task 3: 路由与导航接入
  - [x] 左侧导航新增“首页”入口并置顶
  - [x] 登录后默认进入首页（无 next 时）
  - [x] 原监测页面入口保持可达（新增“监测”入口或原入口迁移）

- [x] Task 4: 兼容性与回归
  - [x] 旧 URL 入口不致 404（必要时做跳转）
  - [x] 移动端可用：轮播与按钮可点击、动效不卡顿
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 1-3
