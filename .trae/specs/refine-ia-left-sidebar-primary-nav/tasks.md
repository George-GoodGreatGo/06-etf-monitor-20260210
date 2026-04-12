# Tasks
- [x] Task 1: 设计并落地 App Shell（左侧导航 + 顶部状态栏）
  - [x] 新增/改造布局组件：左侧 Sidebar（一级导航）+ 顶部 TopBar（账户信息与退出）
  - [x] 顶部栏接入 `GET /api/auth/me` 展示 username；退出沿用现有 logout
  - [x] 确保各栏目在路由切换时高亮正确、刷新可直达

- [x] Task 2: 将 Top200 的状态与操作移入栏目内部
  - [x] “ETF200 列表”页面内展示：DataStatusBanner、数据日期/快照时间、重新获取按钮
  - [x] “AI 解读”页面内展示：同上（复用同一份 Top200 数据与刷新能力）
  - [x] 确保列表筛选仅影响列表页，不影响 AI 解读数据口径（沿用既有约束）

- [x] Task 3: 其它栏目挂接到一级导航
  - [x] “大盘看板”作为独立栏目入口（复用现有 MarketLiquidityPanel）
  - [x] “低波机会”作为独立栏目入口（复用现有 LowVolOpportunityPanel）
  - [x] “数据与方法”纳入侧边栏入口（复用既有 /methodology）

- [x] Task 4: 兼容性与回归
  - [x] 旧入口兼容：`/?tab=list|insight|liquidity|lowvol` 可跳转/映射到新栏目（或保留解析）
  - [x] 未登录时跳转登录页逻辑保持一致
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
