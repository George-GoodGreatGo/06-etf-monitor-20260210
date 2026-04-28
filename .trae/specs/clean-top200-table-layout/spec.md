# Top200 表格布局精简 Spec

## Why
当前列表页表格有三个视觉瑕疵：(1) 斑马纹在深色背景下制造了不必要的视觉噪声，难以让视觉"干净"；(2) 表头文字在小屏或内容稍多时自动换行，破坏列对齐的整齐感；(3) 操作列按钮在列宽不足时文字换行，查看操作按钮本应紧凑明确，换行后显得松散不专业。

## What Changes
- **取消斑马纹**：从数据行 `<tr>` 的 className 中移除 `even:bg-[rgba(255,255,255,0.02)]`
- **表头禁止换行**：给所有 `<th>` 和 `<SortableTh>` 添加 `whitespace-nowrap`，确保表头文字始终单行
- **操作按钮禁止换行**：给 `actionButtonClassName` 添加 `whitespace-nowrap`，确保"查看"按钮文字始终单行

## Impact
- Affected specs: Top200 列表视图
- Affected code:
  - `src/components/Top100Table.tsx` — 3 处改动
- 零破坏：纯 CSS 改动，不改动任何逻辑

## ADDED Requirements

### Requirement 1: 取消斑马纹
系统 SHALL 移除表格数据行的交替背景色，使所有行背景一致。

#### Scenario: 数据行渲染
- **WHEN** 数据行渲染
- **THEN** 所有行背景均为透明（或统一 hover 底色），无偶数行交替色

### Requirement 2: 表头禁止换行
系统 SHALL 确保表头单元格文字始终单行显示，不自动换行。

#### Scenario: 表头渲染
- **WHEN** 表格渲染
- **THEN** 所有 `<th>` 和 `SortableTh` 的按钮文字均显示在一行内，不会因列宽限制而换行

### Requirement 3: 操作按钮禁止换行
系统 SHALL 确保操作列（"查看"按钮）文字始终单行显示。

#### Scenario: 操作按钮渲染
- **WHEN** 数据行渲染操作按钮
- **THEN** "查看"文字与 ExternalLink 图标始终保持在同一行
