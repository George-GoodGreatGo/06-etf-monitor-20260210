# 列表页风格对齐登录页 Spec

## Why
当前列表页与登录页在配色（底色/强调色）、卡片质感（玻璃拟态/阴影/描边）与按钮体系上存在明显割裂，影响整体产品一致性与高级感。

## What Changes
- 列表页（Top200）整体视觉风格对齐登录页：底色、装饰背景、卡片样式、字体层级、间距体系与交互态一致。
- 导航栏品牌区（Logo/标题/右侧信息）对齐登录页 Header 的样式与排版。
- 主要操作按钮（重新获取、退出登录）样式对齐登录页主按钮/次按钮体系。
- 列表页模块卡片（数据状态、筛选、表格、AI 解读）统一使用登录页的玻璃拟态卡片规范。
- **BREAKING**：列表页主色从蓝色强调改为橙色强调（用于按钮/关键交互），以与登录页一致。

## Impact
- Affected specs: 列表页 UI（Top200）、导航栏、数据状态提示、筛选区、表格区、AI 解读区
- Affected code:
  - `src/pages/Home.tsx`
  - `src/components/NavBar.tsx`
  - `src/components/DataStatusBanner.tsx`
  - `src/components/Top100FilterBar.tsx`
  - `src/components/Top100Table.tsx`
  - `src/components/Top100InsightPanel.tsx`
  - `public/figma/login/*`（复用登录页装饰 SVG）

## ADDED Requirements
### Requirement: 列表页视觉一致性
系统 SHALL 在列表页使用与登录页一致的视觉语言（底色、强调色、卡片质感与按钮体系），并保持现有数据/交互逻辑不变。

#### Scenario: 正常访问列表页
- **WHEN** 用户完成登录并进入 Top200 列表页
- **THEN** 页面整体底色与装饰背景与登录页一致
- **AND** 页面中的模块容器以统一卡片样式呈现（玻璃拟态、描边、圆角、阴影）
- **AND** “重新获取/退出登录”按钮在 hover/active/disabled 状态下具备清晰一致的交互反馈

### Requirement: 复用登录页装饰素材
系统 SHALL 复用登录页的装饰 SVG（背景遮罩、底部波浪、品牌图标）用于列表页背景与品牌展示。

#### Scenario: 列表页背景渲染
- **WHEN** 列表页渲染
- **THEN** 背景遮罩与底部波浪装饰正确显示且不遮挡可交互元素

## MODIFIED Requirements
### Requirement: 列表页模块外观
列表页的各模块（数据状态、筛选、表格、AI 解读） SHALL 使用统一的卡片外观规范，并在不同屏幕尺寸下保持可读性与可用性。

## REMOVED Requirements
无

