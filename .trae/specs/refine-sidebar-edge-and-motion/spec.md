# 信息架构优化：左侧导航贴边 + 微动效 Spec

## Why
当前左侧导航已落地，但仍存在两类体验问题：1）侧边栏未完全“浏览器贴边/应用壳层化”，视觉上更像页面内模块；2）缺少符合常见产品规范的交互细节（hover/active/focus、展开/收起、移动端抽屉等），导致导航与操作不够“清晰、可预期”。

## What Changes
- 左侧导航改为**浏览器贴边的固定侧边栏**（全高、左侧 0 距离），内容区在右侧自适应，不随页面滚动离开视野。
- 增强导航可用性与一致性：
  - 清晰的 active 状态（高亮 + 指示条/圆点）
  - hover / pressed / focus-visible 状态
  - 分组标题与间距（信息层级更明确）
- 增加微动效（不引入新库，使用 CSS/Tailwind transition）：
  - hover/active 的颜色与阴影渐变
  - active 指示器平滑切换
  - 移动端抽屉的滑入/滑出动画（最小实现）
- 移动端体验（最小可用）：
  - 顶部状态栏提供“菜单”按钮打开左侧抽屉
  - 抽屉打开时展示遮罩，点击遮罩或按 ESC 关闭
  - 切换导航后自动关闭抽屉

## Impact
- Affected specs: 左侧一级导航的布局与交互体验
- Affected code:
  - `src/components/AppShell.tsx`：布局改为固定侧边栏 + 内容区偏移；移动端抽屉状态管理
  - `src/components/SideNav.tsx`：样式、微动效、可访问性（aria/focus）
  - `src/components/NavBar.tsx`：增加移动端菜单按钮（仅在小屏显示）

## ADDED Requirements
### Requirement: 贴边固定侧边栏
系统 SHALL 将左侧导航渲染为浏览器贴边的固定侧边栏。

#### Scenario: 桌面端滚动
- **WHEN** 用户在内容区滚动页面
- **THEN** 左侧导航保持固定在左侧，不随内容滚动
- **AND** 内容区不会被侧边栏遮挡（正确留出宽度）

### Requirement: 微动效与状态
系统 SHALL 为导航项提供可预期的交互状态与轻量动效。

#### Scenario: Hover/Active/Focus
- **WHEN** 用户 hover 导航项
- **THEN** 背景/描边/文字颜色平滑过渡（transition）
- **WHEN** 导航项为当前 active
- **THEN** 显示更强的高亮与指示器（不依赖颜色也可识别）
- **WHEN** 键盘 Tab 聚焦导航项
- **THEN** 显示 focus-visible 样式，便于无鼠标操作

### Requirement: 移动端抽屉（最小实现）
系统 SHALL 在移动端提供抽屉式侧边导航。

#### Scenario: 打开/关闭抽屉
- **WHEN** 用户点击顶部状态栏的“菜单”按钮
- **THEN** 左侧抽屉从左侧滑入（translate 动画），并显示遮罩
- **WHEN** 用户点击遮罩或按 ESC
- **THEN** 抽屉关闭并回到内容区

#### Scenario: 导航后自动关闭
- **WHEN** 抽屉打开状态下用户点击任一导航项
- **THEN** 完成页面切换后抽屉自动关闭

## MODIFIED Requirements
### Requirement: App Shell 布局
系统 SHALL 将当前“居中容器 + 左侧栏”布局调整为“固定侧边栏 + 可滚动内容区”。

## REMOVED Requirements
无

