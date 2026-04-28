# Top200 列表筛选器改为多选 Spec

## Why
当前 Top200 列表顶部的「交易信号」「新鲜度」「Z值」三个筛选器使用原生 `<select>` 下拉框（单选），用户每次只能选择一个条件。实际操作中，用户经常需要同时查看多个信号类别（如同时看"买入"和"风控卖出"）、或多个新鲜度区间的数据，单选的限制导致需要反复切换筛选条件，体验割裂。

## What Changes
- **类型系统改造**：`top200SignalFilters.ts` 中三个筛选值的类型从单值 `string` 改为 `readonly string[]`（空数组 = 全部），相应的 `matches*` 函数改为支持多值 OR 逻辑
- **UI 改造**：`Top100FilterBar.tsx` 中将信号、新鲜度、Z 三个 `<select>` 下拉框替换为标签式多选组件（Tag Selector），点击 tag 切换选中/取消
- **状态层适配**：`Home.tsx` 中三个 `useState` 的初始值从 `'all'` 改为 `[]`，onChange 回调适配数组类型
- **策略切换时重置**：切换交易策略时，信号筛选重置为 `[]`（全部）——保持现有语义不变

## Impact
- Affected specs: Top200 列表筛选功能
- Affected code:
  - `src/utils/top200SignalFilters.ts` — 类型定义、`matches*` 函数逻辑（3 个函数）
  - `src/components/Top100FilterBar.tsx` — UI 组件（3 个下拉框 → Tag Selector）
  - `src/pages/Home.tsx` — 状态类型、初始值、onChange 回调、策略切换重置逻辑
- **BREAKING**：`Top100FilterBar` 的 `selectedSignal`/`selectedFreshness`/`selectedZ` prop 类型从 `string` 改为 `readonly string[]`，`onChange*` 回调从 `(v: string) => void` 改为 `(v: string[]) => void`

## ADDED Requirements

### Requirement 1: 筛选值类型改为数组
系统 SHALL 将三个筛选器的选中值类型从单字符串改为字符串数组，空数组表示"全部不选=显示所有"。

#### Scenario: 无任何筛选条件
- **WHEN** 筛选器选中值数组为 `[]`
- **THEN** 不应用该维度的筛选逻辑，显示全部数据（等价于原来的 `'all'`）

### Requirement 2: 多选 Tag Selector UI
系统 SHALL 在筛选栏中将信号、新鲜度、Z 值的 `<select>` 下拉组件替换为内联标签（Chip/Tag）组，每个 tag 展示一个选项，点击切换选中状态。

#### Scenario: 默认展开显示所有选项
- **WHEN** 渲染筛选栏
- **THEN** 信号/新鲜度/Z 值各展示一组点击式 tag，每个 tag 左侧或外侧通过透明度/背景色区分选中态

#### Scenario: 选中状态切换
- **WHEN** 用户点击一个未选中的 tag
- **THEN** 该 tag 高亮显示，其值加入选中数组，数据立即按新条件筛选

#### Scenario: 取消选中
- **WHEN** 用户点击一个已选中的 tag
- **THEN** 该 tag 恢复默认样式，其值从选中数组中移除，数据立即按新条件筛选

#### Scenario: 选中全部
- **WHEN** 用户点击"全部"tag 或选中数组变为 `[]`
- **THEN** 显示全部数据，不应用该维度筛选

#### Scenario: 多个维度同时筛选
- **WHEN** 用户同时选中了信号="买入"、新鲜度="当天"、Z 值="\|Z\|>=2.58"
- **THEN** 三个条件取 AND 交集：显示同时满足"买入信号 + 当天新鲜度 + |Z|>=2.58"的数据

#### Scenario: 单维度内多选取 OR
- **WHEN** 用户选中信号="买入" + 信号="风控卖出"
- **THEN** 显示信号为"买入"或"风控卖出"的数据（同一维度内多值取 OR）

### Requirement 3: 匹配逻辑适配数组
系统 SHALL 更新 `matchesSignalFilter`、`matchesFreshnessFilter`、`matchesZFilter` 函数以支持数组参数。

#### Scenario: 空数组
- **WHEN** 传入空数组 `[]`
- **THEN** 返回 `true`（全部匹配）

#### Scenario: 非空数组
- **WHEN** 传入 `['buy', 'risk_sell']`
- **THEN** 数据行信号的 signalKey 在数组中即返回 `true`

### Requirement 4: 策略切换重置信号筛选
系统 SHALL 在切换交易策略时清空信号筛选选项（重置为 `[]`）。

#### Scenario: 切换策略
- **WHEN** 用户切换交易策略下拉框
- **THEN** 信号筛选重置为 `[]`（空数组），新鲜度和 Z 值筛选保持不变

### Requirement 5: 重置按钮
系统 SHALL 在点击"重置"按钮时将三个筛选器全部清空为 `[]`。

#### Scenario: 重置
- **WHEN** 用户点击重置按钮
- **THEN** 信号、新鲜度、Z 值筛选全部重置为 `[]`

## REMOVED Requirements
### Requirement: 单值类型与单一下拉
**Reason**: 被多选 Tag Selector 替代
**Migration**: `selectedSignal`/`selectedFreshness`/`selectedZ` prop 类型从 `string` 改为 `readonly string[]`，`onChange*` 回调从 `(v: string) => void` 改为 `(v: string[]) => void`
