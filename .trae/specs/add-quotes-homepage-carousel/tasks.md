# Tasks
- [x] Task 1: 新增语录数据源（内置）
  - [x] 新增 `src/data/investorQuotes.ts`，提供至少 12 条语录（中/英/出处/作者），覆盖巴菲特/芒格/马克思三位
  - [x] 校验中英文排版长度与标点一致性（避免过长溢出）

- [x] Task 2: 实现轮播组件（自动 + 手动 + 克制动效）
  - [x] 新增 `QuoteCarousel` 组件：自动轮播（默认 8s）、上一条/下一条、指示点
  - [x] hover/聚焦暂停自动轮播，离开后恢复
  - [x] 过渡动效使用 `opacity/translate/scale` + transition（不引入新库）

- [x] Task 3: 新增语录首页页面
  - [x] 新增 `src/pages/Quotes.tsx`，沉浸式版面：深色渐变背景、玻璃卡片、明确层级
  - [x] 集成 `QuoteCarousel`，并在页内提供简短引导文案（强调理性与耐心）

- [x] Task 4: 路由与导航接入
  - [x] 在 `src/App.tsx` 增加路由 `/quotes`（RequireAuth + AppShell 内）
  - [x] 在 `src/components/SideNav.tsx` 增加“语录首页”入口（NavLink）

- [x] Task 5: 回归与验收
  - [x] `/quotes` 需要登录；未登录访问会跳转登录页
  - [x] 轮播自动播放 + 手动切换工作正常；暂停/恢复逻辑正常
  - [x] 语录中英文与出处均展示；视觉层级清晰、动效不突兀
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
- Task 4 depends on Task 3
- Task 5 depends on Task 1-4
