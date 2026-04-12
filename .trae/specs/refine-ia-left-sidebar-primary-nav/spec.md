# 信息架构优化：左侧一级导航 + 顶部账户状态栏 Spec

## Why
当前首页将“Top200 列表 / AI 解读 / 大盘看板 / 低波机会”以同页 Tab 方式承载，且全局顶部栏同时混合了导航、数据时间、重新获取、退出登录等控件。随着模块增多，层级不清晰、控件归属不明确，用户难以建立稳定的“在哪里看什么、在哪里操作什么”的心智模型。

## What Changes
- 将以下入口统一为**一级导航**，放置在屏幕左侧（侧边栏）：
  - ETF200 列表
  - AI 解读
  - 大盘看板
  - 低波机会
  - 数据与方法
- 将“控制按钮/数据日期/数据状态条/重新获取”等**模块相关控件**移动到对应栏目内部（页面头部/模块头部），不再放在全局导航区。
- 顶部状态栏仅保留与“账户会话”相关的信息与操作：
  - 展示当前登录账户（username）
  - 退出按钮

## Impact
- Affected specs: 首页信息架构、导航结构、Top200 列表与 AI 解读的入口与状态展示位置
- Affected code:
  - `src/pages/Home.tsx`：拆分/重构为路由页或独立页面组件
  - `src/components/NavBar.tsx`：改造为“顶部状态栏”（仅账户信息与退出）
  - `src/pages/Methodology.tsx`（若存在）/ 路由配置：统一纳入左侧导航
  - `src/components/DataStatusBanner.tsx`：保持组件能力不变，仅调整出现位置
  - `server/routes/auth.ts`：复用 `GET /api/auth/me` 获取 username（无需新增接口）

## ADDED Requirements
### Requirement: 左侧一级导航
系统 SHALL 提供左侧侧边栏作为一级导航，包含 “ETF200 列表 / AI 解读 / 大盘看板 / 低波机会 / 数据与方法” 五个入口。

#### Scenario: 导航可达
- **WHEN** 用户进入任一栏目
- **THEN** 左侧导航可见（桌面端）
- **AND** 当前栏目高亮显示
- **AND** 点击任一入口可切换到对应栏目

### Requirement: 模块控件归位
系统 SHALL 将模块相关控件放回对应栏目内部，而非全局导航区。

#### Scenario: Top200 的刷新与状态归位
- **WHEN** 用户进入“ETF200 列表”或“AI 解读”
- **THEN** 页面内展示 Top200 数据状态条（DataStatusBanner）
- **AND** 页面内展示 Top200 的数据日期/快照时间
- **AND** 页面内提供“重新获取”按钮

#### Scenario: 其它栏目保持自洽
- **WHEN** 用户进入“大盘看板”或“低波机会”
- **THEN** 其数据状态/日期/局部控件在栏目自身面板内展示（沿用既有逻辑）

### Requirement: 顶部账户状态栏
系统 SHALL 在顶部展示账户状态栏，包含登录账户与退出按钮。

#### Scenario: 已登录
- **WHEN** `GET /api/auth/me` 返回 `authenticated=true`
- **THEN** 顶部状态栏展示 username
- **AND** 用户可点击“退出”完成登出并返回登录页

#### Scenario: 未登录
- **WHEN** `GET /api/auth/me` 返回 `authenticated=false`（或 Top200 数据请求返回 401）
- **THEN** 系统跳转至登录页（沿用现有登录流程）

## MODIFIED Requirements
### Requirement: Home 的 Tab 结构
系统 SHALL 将原先位于首页顶部的“Tab 切换”弱化/移除，并由左侧一级导航承载“列表/AI 解读/大盘看板/低波机会”的入口。

**BREAKING**：若实现为独立路由，URL 结构将发生变化；需要提供从旧 URL（如 `/?tab=...`）到新路由的兼容跳转或保留解析。

## REMOVED Requirements
### Requirement: 全局顶部导航承载数据状态与刷新
**Reason**: 数据状态与刷新属于模块级操作，放在全局导航会造成归属混乱。
**Migration**: 将相关展示与按钮移入对应栏目页面头部（尤其是 Top200）。

