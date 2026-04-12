# 信息架构优化：顶部栏对齐 + 导航动效优化 + 侧栏折叠 Spec

## Why
当前已实现左侧贴边导航与移动端抽屉，但仍存在三个体验问题：1）顶部状态栏的 Logo 与左侧导航在视觉上“对齐关系不舒服”，整体不够统一；2）切换导航时 active 高亮变化过于突兀；3）桌面端缺少侧栏折叠能力，影响内容可视区域与信息密度控制。

## What Changes
- 顶部状态栏布局优化：
  - 桌面端：顶部栏内容区与主内容区对齐，并为左侧固定侧栏预留空间（与侧栏宽度联动）。
  - 移动端：保持菜单按钮 + Logo 的现有布局。
- 左侧导航 active 动效优化（不引入新库）：
  - 引入“连续”的 active 指示器（背景胶囊/边条），在不同导航项之间平滑移动（CSS transition + 轻量 JS 计算位置）。
  - 保留 hover/pressed/focus-visible 细节，但避免 route 切换瞬间的“闪跳感”。
- 左侧导航折叠能力（桌面端）：
  - 提供折叠/展开按钮。
  - 折叠态下侧栏变窄（例如 72px），仅显示图标；展开态显示图标 + 文案。
  - 折叠状态持久化（localStorage）。
  - 内容区与顶部栏对齐随侧栏宽度动态调整。

## Impact
- Affected specs: 左侧导航交互与布局、顶部状态栏视觉对齐
- Affected code:
  - `src/components/AppShell.tsx`：侧栏宽度状态、内容区/顶部栏对齐联动、移动端抽屉保持
  - `src/components/SideNav.tsx`：折叠/展开 UI、active 指示器平滑移动、图标与可访问性
  - `src/components/NavBar.tsx`：顶部栏对齐策略（桌面端预留侧栏宽度），保留移动端菜单按钮

## ADDED Requirements
### Requirement: 顶部栏与内容区对齐
系统 SHALL 在桌面端将顶部状态栏的视觉对齐基准改为“主内容区”，并预留固定侧栏宽度，使 Logo/按钮与内容区更协调。

#### Scenario: 桌面端对齐
- **WHEN** 视口宽度 ≥ md
- **THEN** 顶部栏左侧内容的起始位置与主内容区的起始位置一致（考虑侧栏宽度与内容 padding）

### Requirement: 导航 active 平滑动效
系统 SHALL 在导航切换时提供平滑的 active 指示器移动动效，避免突兀跳变。

#### Scenario: 切换导航
- **WHEN** 用户点击不同导航项（或通过 URL 变化切换）
- **THEN** active 指示器在 150–250ms 内平滑移动到目标项位置（ease-out）
- **AND** 动效不影响可点击区域与滚动

### Requirement: 桌面端侧栏可折叠
系统 SHALL 在桌面端提供侧栏折叠/展开能力，并记住用户选择。

#### Scenario: 折叠/展开
- **WHEN** 用户点击折叠按钮
- **THEN** 侧栏宽度平滑过渡到折叠宽度（例如 72px），导航文案隐藏，仅保留图标
- **WHEN** 用户点击展开按钮
- **THEN** 侧栏宽度平滑恢复，显示图标与文案

#### Scenario: 状态持久化
- **WHEN** 用户刷新页面或重新打开页面
- **THEN** 侧栏折叠状态从 localStorage 恢复

#### Scenario: 可访问性
- **WHEN** 侧栏处于折叠态
- **THEN** 每个导航项依然可识别（通过 tooltip/title 或 aria-label）
- **AND** 键盘 focus-visible 样式仍有效

## MODIFIED Requirements
### Requirement: App Shell 布局联动
系统 SHALL 让顶部栏、侧栏、内容区在折叠/展开时保持一致的空间占用与对齐关系（避免内容抖动与遮挡）。

## REMOVED Requirements
无

