# 筛选区 UI 调优 Spec

## Why
当前筛选区域存在三个细节问题：(1) Tag 组件字体偏小（`text-[11px]`），在深色背景下辨识度不足；(2) 各组件的间距、对齐方式偏松散，缺乏互联网产品常见的紧凑精密感；(3) "重置"按钮在小屏时会换行，破坏操作区的一致感。

## What Changes
- **字体放大**：Tag 按钮字体从 `text-[11px]` 提升到 `text-xs`，group label 从 `text-xs` 提升到 `text-sm`，保持层级分明
- **对齐与间距调优**：group label 宽度固定（`w-10` 或 `w-12`）实现垂直对齐；Tag 行间距收紧；整体层级更清晰
- **重置按钮禁止换行**：添加 `whitespace-nowrap`

## Impact
- Affected specs: 筛选区 UI
- Affected code: `src/components/Top100FilterBar.tsx`
- 零破坏：纯 CSS 改动

## MODIFIED Requirements

### Requirement: Tag 组件视觉升级
系统 SHALL 在筛选区使用更大的字体和更紧凑的间距，提升可读性和专业感。

#### Scenario: Tag 字体
- **WHEN** 筛选区渲染
- **THEN** Tag 按钮字体为 `text-xs`（12px），group label 字体为 `text-sm`（13.33px）

#### Scenario: Label 对齐
- **WHEN** 筛选区渲染
- **THEN** 四个 group（策略/信号/新鲜度/Z值）的 label 列左对齐统一宽度

#### Scenario: 重置按钮
- **WHEN** 筛选区渲染
- **THEN** 重置按钮始终不换行（`whitespace-nowrap`）
