# Top200 ETF 列表 Phase 1 快速见效优化 Spec

## Why
当前 Top200 ETF 列表在视觉层次、信息可读性和操作效率上存在 6 个高影响低成本的问题：Z 值无颜色分级、列头冗长且无 Tooltip、表格行缺乏斑马纹、底部状态栏文案误导、Hover 效果微弱、信号 Badge 对比度偏低。这些问题导致扫读效率低、关键信息不易定位。本 spec 仅覆盖极低成本改动（每个点 ≤30 行），30 分钟内可完成全部 6 项。

## What Changes
- **Z值颜色分级**：`ZBadge.tsx` 根据 Z 值绝对值分段显示不同颜色徽章，对齐筛选栏已有的 Z 值分段阈值
- **列头简化+Tooltip**：`Top100Table.tsx` 列头文案简化，`SortableTh.tsx` 支持 `title` 属性实现鼠标悬停显示完整说明
- **斑马纹**：`Top100Table.tsx` 表格偶数行增加交替背景色，提升 200 行数据的视觉定位效率
- **底部状态栏文案修正**：移除误导性"滚动查看更多"，改为"共 XX 条记录"
- **Hover效果增强**：`Top100Table.tsx` 行 hover 从 `#1E293B` 改为品牌橙微光 `rgba(255,87,34,0.06)`
- **信号Badge对比度增强**：`Top100Table.tsx` 交易信号 Badge 文字和背景对比度提升，更易辨识

## Impact
- Affected specs: Top200 ETF 列表视图
- Affected code:
  - `src/components/Top100Table.tsx` — 列头文案、斑马纹、状态栏、Hover增强、信号Badge对比度
  - `src/components/SortableTh.tsx` — 增加 title tooltip 支持
  - `src/components/ZBadge.tsx` — Z 值颜色分级
- 零破坏：不改动任何数据处理逻辑、API 调用、状态管理、图表组件
- 不改动表格列数结构（不新增/删除列）

## ADDED Requirements

### Requirement 1: Z 值徽章颜色分级
系统 SHALL 在 `ZBadge` 组件中根据 Z 值的绝对值显示不同颜色的徽章，以帮助用户一眼识别极端异动。

#### Scenario: Z 值达到极高异动
- **WHEN** `|Z| ≥ 2.58`
- **THEN** 徽章显示为红色调（文字 `#FCA5A5`，背景 `rgba(127,29,29,0.22)`，边框 `rgba(248,113,113,0.28)`）

#### Scenario: Z 值达到高异动
- **WHEN** `1.96 ≤ |Z| < 2.58`
- **THEN** 徽章显示为橙色调（文字 `#FCD34D`，背景 `rgba(120,53,15,0.22)`，边框 `rgba(251,191,36,0.28)`）

#### Scenario: Z 值达到中异动
- **WHEN** `1.65 ≤ |Z| < 1.96`
- **THEN** 徽章显示为蓝色调（文字 `#93C5FD`，背景 `rgba(30,58,138,0.22)`，边框 `rgba(96,165,250,0.28)`）

#### Scenario: Z 值低于阈值
- **WHEN** `|Z| < 1.65`
- **THEN** 徽章保持灰色（文字 `#9CA3AF`，背景 `rgba(255,255,255,0.04)`，边框 `rgba(255,255,255,0.10)`）

#### Scenario: Z 值为 null
- **WHEN** `z == null`
- **THEN** 显示 `—`，灰色徽章

#### Scenario: 数据状态非 complete
- **WHEN** `status !== 'complete'`
- **THEN** 保持现有行为，显示 `数据不完整` 或 `拉取失败` 灰色徽章

### Requirement 2: 列头文案简化与 Tooltip
系统 SHALL 在 Top100Table 的列头中使用简洁文案，并通过鼠标悬停 tooltip 展示完整说明。

#### Scenario: 列头展示简化文案
- **WHEN** 表格渲染
- **THEN** 列头中 `今日成交量(份)` → `成交量`、`今日成交额(元)` → `成交额`、`成交额较昨%` → `较昨±`、`成交额较7日均%` → `较7日均±`，其余列头不变

#### Scenario: 鼠标悬停显示完整说明
- **WHEN** 用户鼠标悬停在简化后的列头
- **THEN** 浏览器原生 tooltip 显示完整列名说明

#### Scenario: 排序功能不受影响
- **WHEN** 用户点击简化后的列头
- **THEN** 排序功能正常工作，sortKey 映射不变

### Requirement 3: 表格行斑马纹
系统 SHALL 为表格偶数行增加交替背景色，提升密集数据的视觉定位能力。

#### Scenario: 交替行背景
- **WHEN** 表格渲染数据行
- **THEN** 偶数行显示 `even:bg-[rgba(255,255,255,0.02)]`，奇数行保持透明

#### Scenario: Hover 效果层级正确
- **WHEN** 用户鼠标悬停在偶数行
- **THEN** hover 背景色覆盖斑马纹背景色

### Requirement 4: 底部状态栏文案准确
系统 SHALL 在表格底部显示准确的数据量信息，不使用误导性文案。

#### Scenario: 有数据时
- **WHEN** `data.length > 0`
- **THEN** 左侧显示 `共 ${data.length} 条记录`

#### Scenario: 右侧保持不变
- **WHEN** `data.length > 0`
- **THEN** 右侧仍显示 `到底了`

#### Scenario: 无数据时
- **WHEN** `data.length === 0`
- **THEN** 不显示底部状态栏（由空状态行处理）

### Requirement 5: Hover 效果增强
系统 SHALL 使用品牌橙微光增强表格行 hover 效果，提升用户定位当前行的感知。

#### Scenario: 鼠标悬停
- **WHEN** 用户鼠标悬停在表格数据行
- **THEN** 行背景变为 `bg-[rgba(255,87,34,0.06)]`，带 `transition-colors duration-150` 过渡动画

#### Scenario: 鼠标离开
- **WHEN** 用户鼠标离开表格数据行
- **THEN** 行背景过渡回原始状态

### Requirement 6: 信号 Badge 对比度增强
系统 SHALL 提升交易信号 Badge 的文字和背景对比度，使买卖信号更易辨识。

#### Scenario: 买入信号
- **WHEN** `signalKey === 'buy'`
- **THEN** 文字 `#FECACA`，背景 `rgba(127,29,29,0.35)`，边框 `rgba(248,113,113,0.35)`

#### Scenario: 卖出信号
- **WHEN** `signalKey === 'sell'`
- **THEN** 文字 `#BBF7D0`，背景 `rgba(6,78,59,0.35)`，边框 `rgba(16,185,129,0.35)`

#### Scenario: 风控卖信号
- **WHEN** `signalKey === 'risk_sell'`
- **THEN** 文字 `#FDE68A`，背景 `rgba(120,53,15,0.35)`，边框 `rgba(251,191,36,0.35)`

#### Scenario: 无信号
- **WHEN** 信号为空
- **THEN** 保持 `—` 灰色占位不变
