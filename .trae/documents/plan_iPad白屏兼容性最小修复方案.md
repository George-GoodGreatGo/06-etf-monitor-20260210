# iPad 白屏兼容性最小修复方案（iPadOS 13+）

## Summary
- 目标：修复 `https://traemqq87e12.vercel.app/` 在 iPad 访问时可能出现的白屏问题，兼容范围定为 `iPadOS 13+`，采用最小改动策略。
- 结论（基于已探索现状）：当前前端未配置明确的 Safari 降级策略，且存在移动端新特性样式使用（如 `100dvh`），有较高概率在旧 WebKit 上触发启动失败或首屏不可见。
- 实施原则：优先保证“能打开、能登录、能进入主流程”，不做无关重构。

## Current State Analysis
- 构建配置现状：
  - `vite.config.ts` 仅包含 React、路径别名和 Trae Badge 插件，未配置 legacy 兼容插件或明确浏览器 target。
  - `package.json` 当前依赖不含 `@vitejs/plugin-legacy`。
- 启动链路现状：
  - `src/main.tsx` 仅处理 `unhandledrejection`，没有针对启动期异常的可视化兜底。
  - `src/components/RequireAuth.tsx` 在鉴权完成前返回 `null`，若异常场景下路由跳转不生效，首屏可能持续空白。
- UI 兼容性现状：
  - `src/pages/QuotesHome.tsx` 使用 `h-[calc(100dvh-72px)]`，旧版 iPad Safari 对 `dvh` 支持不稳定时可能导致布局异常。
- 线上现象补充：
  - 通过浏览器自动化访问该地址，首个快照曾出现仅 `document`、无可交互节点；后续跳到 `/login` 可见内容，说明存在“启动早期不稳定”风险。

## Proposed Changes

### 1) 增加 iPadOS 13+ 的构建降级能力（核心）
- 文件：`package.json`
  - 新增依赖：`@vitejs/plugin-legacy`（devDependency）。
- 文件：`vite.config.ts`
  - 接入 `legacy()` 插件。
  - 目标浏览器设为覆盖 iPadOS 13+ 对应 Safari 能力（以 Safari 13 为下限）。
  - 保持其余插件顺序稳定，仅做必要插入，避免影响现有功能。
- Why：
  - 通过产出 legacy bundle + 必要 polyfill，降低旧版 WebKit 在解析现代语法或缺失 API 时的白屏概率。

### 2) 提供启动失败时的最小可见兜底
- 文件：`src/main.tsx`
  - 增加 `window.onerror` / 启动异常兜底：当 React 根节点未成功渲染时，向 `#root` 注入极简错误提示文案（仅在启动失败路径触发）。
  - 保留当前 `unhandledrejection` 对 `AbortError` 的抑制逻辑。
- Why：
  - 即使仍出现边缘兼容问题，也避免用户只看到“纯白屏”，便于引导刷新或更换浏览器内核。

### 3) 为 `dvh` 提供稳妥回退（最小样式修正）
- 文件：`src/pages/QuotesHome.tsx`
  - 将首屏容器高度从单一 `100dvh` 改为“兼容写法 + 回退”（例如默认 `vh`，支持时使用 `dvh` 覆盖）。
- Why：
  - 避免旧 iPad Safari 对动态视口单位处理异常导致首屏区域高度计算错误。

### 4) 首屏鉴权等待态最小可视化（防空白）
- 文件：`src/components/RequireAuth.tsx`
  - 在 `ok !== true` 期间提供轻量 loading 占位，而不是直接 `null`。
  - 不改变鉴权流程与路由行为，仅改变“等待期间可见性”。
- Why：
  - 即便鉴权请求慢、网络抖动或跳转延迟，用户不再看到空白页面。

## Assumptions & Decisions
- 兼容目标已锁定为：`iPadOS 13+`。
- 变更策略已锁定为：最小修复（不做大规模 UI/架构改造）。
- 不调整现有业务 API、鉴权协议、数据库与部署链路；仅前端构建/启动/首屏展示层改动。
- `vite-plugin-trae-solo-badge` 保留，若与 legacy 产物存在冲突，再做最小隔离（仅在冲突被验证时处理）。

## Verification Steps
- 本地验证：
  - 执行构建，确认产物生成 legacy 相关脚本且无构建错误。
  - 本地预览，检查 `/`、`/login`、`/market` 三个入口页面可正常渲染。
- 兼容验证（重点）：
  - 在 iPadOS 13/14/15 的 Safari（真机或云真机）访问 Vercel 预览地址。
  - 验证首次打开、无痕模式、弱网（高延迟）下不出现纯白页。
- 回归验证：
  - Google 登录流程可打开登录页并能完成跳转。
  - 主页面图表/导航可见，未引入明显交互回退。
- 验收标准：
  - iPadOS 13+ Safari 访问根路径时，2-5 秒内至少可见登录页或加载态，不出现持续白屏。
  - 控制台无阻断渲染的启动级错误（允许非阻断 warning）。
