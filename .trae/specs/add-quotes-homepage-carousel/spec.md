# 语录首页：投资理性与耐心轮播 Spec

## Why
当前应用以数据监测为主，缺少“情绪锚点”。新增一个沉浸式语录首页，用巴菲特、查理·芒格、霍华德·马克思的经典金句强化用户在投资决策中保持理性与耐心的心智，同时提供中英文对照与出处，便于理解与引用。

## What Changes
- 新增一个需要登录才能访问的独立页面：`/quotes`（作为“语录首页”）。
- 页面以沉浸式设计呈现语录轮播：
  - 自动轮播（例如 8 秒/条）+ 手动切换（上一条/下一条 + 指示点）
  - 中英文同时展示，并提供出处（书名/股东信/备忘录/演讲等）
  - 过渡动效为平滑淡入淡出/轻微位移缩放，风格克制高级（不引入新动画库）
- 左侧导航新增入口“语录首页”，便于随时进入。

## Impact
- Affected specs: 左侧一级导航入口扩展、应用内新增沉浸式内容页
- Affected code:
  - `src/App.tsx`：增加路由 `/quotes`（RequireAuth + AppShell 内）
  - `src/components/SideNav.tsx`：新增导航入口
  - `src/pages/Quotes.tsx`：新增页面
  - `src/components/QuoteCarousel.tsx`（或同名组件）：轮播逻辑与动效（纯 React + CSS transition）
  - `src/data/investorQuotes.ts`：内置语录数据（中英 + 出处 + 作者）

## ADDED Requirements
### Requirement: 语录首页路由
系统 SHALL 提供登录后可访问的 `GET /quotes` 页面入口（前端路由）。

#### Scenario: 访问控制
- **WHEN** 未登录用户访问 `/quotes`
- **THEN** 系统跳转到登录页（沿用现有鉴权逻辑）

### Requirement: 语录数据结构
系统 SHALL 内置语录数据，至少覆盖三位作者：巴菲特、查理·芒格、霍华德·马克思。
- 每条语录 SHALL 包含：
  - `author`（作者名）
  - `quoteZh`（中文）
  - `quoteEn`（英文）
  - `source`（出处文本，如《书名》/年份/信件/备忘录标题）

#### Scenario: 中英文与出处展示
- **WHEN** 语录卡片渲染
- **THEN** 同时展示中文与英文
- **AND** 展示出处与作者

### Requirement: 轮播交互与动效
系统 SHALL 提供自动轮播与手动切换，并以“克制高级”的动效呈现。

#### Scenario: 自动轮播
- **WHEN** 用户进入语录首页
- **THEN** 页面每隔固定时间自动切换到下一条
- **AND** 轮播到末尾后循环回到开头

#### Scenario: 手动切换
- **WHEN** 用户点击“上一条/下一条”
- **THEN** 立即切换到对应语录
- **AND** 指示点同步更新
- **WHEN** 用户点击指示点
- **THEN** 切换到对应索引语录

#### Scenario: 交互暂停（可用性）
- **WHEN** 用户鼠标悬停语录卡片或键盘聚焦到控制按钮
- **THEN** 自动轮播暂停
- **WHEN** 用户离开悬停/聚焦
- **THEN** 自动轮播恢复

### Requirement: 沉浸式视觉风格
系统 SHALL 将语录页设计为“聚焦语录”的沉浸式版面，减少其他信息露出，整体风格趋近 Apple 官网的克制高级感。
- 背景 SHOULD 使用深色 + 轻量渐变/光晕
- 排版 SHOULD 强调留白与层级（主语录 > 译文 > 作者/出处）
- 动效 SHOULD 使用 `opacity/transform` 过渡（避免夸张弹跳）

## MODIFIED Requirements
### Requirement: 左侧导航入口
系统 SHALL 在左侧导航新增“语录首页”入口，指向 `/quotes`。

## REMOVED Requirements
无

