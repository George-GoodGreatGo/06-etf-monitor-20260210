# 首页拆分为“列表/AI 解读”两个 Tab Spec

## Why
当前首页把“列表筛选+状态+表格+AI 解读”集中在一个长页面里，信息密度高、阅读路径混杂；拆分为 Tab 能降低认知负担并突出 AI 解读的价值。

## What Changes
- 首页（Top200）新增 Tab 切换：
  - Tab 1：列表（保持现有列表体验）
  - Tab 2：AI 解读（专注展示 AI 结论与生成控制）
- Tab 状态与 URL 同步（可分享/可刷新保持）：使用查询参数 `tab=list|insight`。
- 共享同一份数据源：AI 解读与列表均使用同一份 Supabase 快照数据（同一次拉取得到的 Top200 数据），避免重复请求。
- 列表筛选（查找）功能仅从属于“列表”Tab，且其筛选结果不影响 AI 解读的数据口径。
- Tab UI 样式沿用登录页/新版列表页的“玻璃拟态 + 橙色强调”体系。
- **BREAKING**：默认首屏展示“列表”Tab；原先首页中 AI 解读位于列表上方的布局将改为 Tab 内展示。

## Impact
- Affected specs: 首页信息架构、AI 解读入口、筛选与数据展示布局
- Affected code:
  - `src/pages/Home.tsx`
  - `src/components/Top100InsightPanel.tsx`（仅在需要适配全宽/独立展示时调整）
  - `src/components/Top100FilterBar.tsx`（仅在需要抽取到 Tab 头部时调整）
  - `src/components/NavBar.tsx`（不强制改动；如需要可补充 Tab 入口样式一致性）

## ADDED Requirements
### Requirement: 首页 Tab 切换
系统 SHALL 在首页提供“列表/AI 解读”两个 Tab，并在不改变数据逻辑的情况下切换展示内容。

#### Scenario: 默认进入首页
- **WHEN** 用户访问 `/`
- **THEN** 默认显示“列表”Tab
- **AND** “列表”Tab 内包含现有筛选、状态、表格等内容

#### Scenario: 切换到 AI 解读
- **WHEN** 用户点击 “AI 解读”Tab
- **THEN** 显示 AI 解读内容区（包含生成/重试等现有能力）
- **AND** 不重复触发数据拉取（复用当前 rows/meta 状态）

#### Scenario: URL 直达与刷新保持
- **WHEN** 用户访问 `/?tab=insight`
- **THEN** 默认打开“AI 解读”Tab
- **AND** 页面刷新后仍保持在 “AI 解读”Tab

### Requirement: Tab 与筛选联动
系统 SHALL 将“筛选（查找）”功能限定在“列表”Tab 内使用，且不改变 AI 解读所使用的数据集（Top200 的 Supabase 快照数据）。

#### Scenario: 列表筛选不影响 AI 解读
- **WHEN** 用户在“列表”Tab 输入关键字进行筛选
- **THEN** 仅列表展示结果被筛选
- **AND** 用户切换到“AI 解读”Tab 后，AI 解读仍基于 Top200 快照全量数据生成（不受列表筛选影响）

## MODIFIED Requirements
### Requirement: 首页布局
首页 SHALL 将原本的“AI 解读面板 + 表格”纵向布局改为 Tab 内分区展示，保持核心功能可达且可用性不下降（移动端同样可用）。

## REMOVED Requirements
无
