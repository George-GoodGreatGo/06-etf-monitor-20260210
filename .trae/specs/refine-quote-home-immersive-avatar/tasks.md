# Tasks
- [x] Task 1: 头像数据模型与组件
  - [x] 为三位作者定义头像展示方案（优先：本地静态图片；fallback：首字母/剪影徽章）
  - [x] 在 quotes 数据中补充作者头像元信息（不改变现有 quote 字段）
  - [x] 新增轻量 Avatar 组件（圆形/方圆角、暗色系、可复用）

- [x] Task 2: QuoteCarousel 沉浸式呈现
  - [x] 在语录卡片中加入作者头像区域（与作者名/出处形成统一信息块）
  - [x] 收敛控件视觉：默认弱化，hover/聚焦增强；不影响可访问性
  - [x] 切换动效进一步沉稳（淡入/小位移/轻微模糊可选），不突兀

- [x] Task 3: QuoteHome 页面减法
  - [x] 移除或大幅弱化非核心说明性模块
  - [x] 让首页主体更接近“单页沉浸”：内容居中、留白更大、背景更克制

- [x] Task 4: 回归与验收
  - [x] 首页更沉浸：首屏几乎只看到语录 + 作者/出处 + 轻量控件
  - [x] 头像展示正确（无素材时 fallback 也有头像观感）
  - [x] 移动端可用，按钮点击区域合理
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
