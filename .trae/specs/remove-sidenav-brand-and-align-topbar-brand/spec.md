# 顶部品牌对齐 + 移除侧栏品牌 Spec

## Why
当前左侧导航顶部存在站点 Logo/品牌名，与“顶部状态栏常驻品牌”的设计冲突；同时希望顶部状态栏的品牌起始位置与左侧导航选项图标的最左侧严格对齐，以获得更统一的视觉基线。

## What Changes
- 移除左侧导航（SideNav）顶部的站点 Logo 与品牌名区域，仅保留导航分组与导航项。
- 顶部状态栏（NavBar）保持常驻站点 Logo + 品牌名。
- 顶部状态栏中的“Logo+品牌名”整体起始 x 位置与左侧导航中“导航项图标”的最左侧对齐（桌面端为准）。
- 侧栏折叠/展开不影响上述对齐关系（折叠/展开后对齐仍成立）。

## Impact
- Affected specs: 侧边栏与顶部栏的视觉对齐规则
- Affected code:
  - `src/components/SideNav.tsx`：移除品牌区；折叠态下保持导航图标起始位置一致
  - `src/components/NavBar.tsx`：顶部品牌常驻；调整容器内边距以匹配侧栏图标起始位置
  - `src/components/AppShell.tsx`：如需，将对齐基准提取为共享变量（可选）

## ADDED Requirements
### Requirement: 顶部品牌常驻
系统 SHALL 在顶部状态栏展示站点 Logo 与品牌名，并在所有已登录页面常驻。

#### Scenario: 常驻展示
- **WHEN** 用户进入任一已登录页面
- **THEN** 顶部状态栏展示站点 Logo 与品牌名

### Requirement: 移除侧栏品牌区
系统 SHALL 移除左侧导航顶部的站点 Logo 与品牌名，仅保留导航项。

#### Scenario: 侧栏无品牌区
- **WHEN** 用户观察左侧导航
- **THEN** 左侧导航顶部不展示站点 Logo 与品牌名

### Requirement: 顶部品牌与侧栏图标对齐
系统 SHALL 让顶部状态栏的品牌起始位置与左侧导航“导航项图标”的最左侧对齐（桌面端）。

#### Scenario: 对齐一致
- **WHEN** 侧栏处于展开或折叠状态
- **THEN** 顶部品牌的左边缘与导航项图标左边缘在同一条竖线上

## MODIFIED Requirements
### Requirement: 折叠态图标布局
系统 SHALL 在侧栏折叠态下保持导航项图标的左边缘位置不变（不居中），以确保与顶部品牌对齐一致。

## REMOVED Requirements
无

