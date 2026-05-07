# Hero 卡片指标布局均分 + 颜色统一 + RSI 修复 + 高度压缩 Spec

## Why
上一轮已将 Hero 卡片重构为主/副指标 2 行布局，但存在 5 个遗留问题：
1. 主指标使用 `flex flex-wrap` 导致指标全部堆在左侧，应平铺均分填充整行
2. Score 颜色遵循了国际「绿涨红跌」惯例，与中国 A 股「红涨绿跌」惯例冲突，需要统一
3. 90 日 Z 值使用 `ZBadge` 胶囊样式，与 Hero 内其他纯文本指标风格不一致
4. Hero 卡片整体高度偏高（大字号 + 多行），需进一步压缩
5. Hero 中的 RSI 数值由自写 `computeRsi` 计算，与图表中 `buildRsi` 初始化方式不同，导致数值不一致

## What Changes
- **布局均分**：主指标行从 `flex` 改为 `grid grid-cols-6`（桌面端 6 列均分），移动端自动折行
- **红涨绿跌**：修改 `resolveScoreState` 函数中 `score > 0` → 红色系，`score < 0` → 绿色系（对齐 `pctToneCls` 中已有惯例）
- **Z 值去胶囊**：移除 `ZBadge` 组件引用，改为纯数字 `font-mono text-lg`
- **高度压缩**：Score 字号 `text-2xl` → `text-xl`，其他指标 `text-lg` → `text-base`，移除 Score Badge 行（合并到 Score 行内），压缩 padding
- **RSI 修复**：修正 `computeRsi` 初始化逻辑为从数组开头计算（与图表 `buildRsi` 完全一致），确保 Hero RSI = 图表最新 RSI

## Impact
- Affected specs: `refine-momentum-summary-hero-and-deborder`
- Affected code: `src/components/RpsStylePanel.tsx`（`resolveScoreState`、`computeRsi`、Hero JSX、移除 ZBadge 导入）、`mock/momentum-analysis.html`
- **BREAKING**: 无，`ZBadge` 仍被其他组件使用，仅移除 Hero 中的引用

## MODIFIED Requirements

### Requirement: 主指标行平铺均分
主指标 6 项（Score / 成交额 / 放量倍数 / 较昨变化 / 较前7日均变化 / 90日Z值）SHALL 使用 `grid grid-cols-6` 在桌面端均分整行，各指标占据等宽列。竖分隔线（`w-px bg-white/10`）放在每个 grid item 内部右侧。

#### Scenario: 桌面端 6 列均分
- **WHEN** 视口宽度 ≥ 640px（`sm:`）
- **THEN** 6 个主指标等宽排列在一行
- **THEN** 指标之间用竖线分隔

#### Scenario: 移动端自动折行
- **WHEN** 视口宽度 < 640px
- **THEN** 指标自动折行为 `grid-cols-3` 再折行为 `grid-cols-2`

### Requirement: 统一红涨绿跌
系统 SHALL 在 Hero 卡片内所有数值指标统一使用 A 股惯例「红涨绿跌」：正数/上涨 = 红色，负数/下跌 = 绿色。

#### Scenario: Score > 0 显示红色
- **WHEN** Score 值为正数
- **THEN** Score 文字颜色为红色系（`text-[#EF4444]`）
- **THEN** Score Badge 边框/背景使用红色系

#### Scenario: Score < 0 显示绿色
- **WHEN** Score 值为负数
- **THEN** Score 文字颜色为绿色系（`text-[#10B981]`）

### Requirement: Z 值纯文本展示
90 日 Z 值 SHALL 在 Hero 中展示为纯数字文本（`font-mono text-lg font-semibold`），不使用 `ZBadge` 胶囊样式。

#### Scenario: Z 值无胶囊
- **WHEN** Hero 渲染 90 日 Z 值指标
- **THEN** 显示数字值如 `+1.82`，颜色跟随数值正负（红涨绿跌）
- **THEN** 不再引用 `<ZBadge>` 组件

### Requirement: Hero 高度压缩
Hero 容器 SHALL 减小内边距和字号以降低总高度。

#### Scenario: 压缩后高度降低
- **WHEN** Hero 渲染后
- **THEN** Score 使用 `text-xl`（原 `text-2xl`）
- **THEN** 其他主指标值使用 `text-base`（原 `text-lg`）
- **THEN** 容器 padding 从 `p-5` 减为 `p-4`
- **THEN** Score Badge 行移入 Score 块内，与 Score 值同行

### Requirement: RSI 与图表一致
系统 SHALL 确保 Hero 中显示的 RSI 值与图表 `buildRsi` 计算的最新值一致。

#### Scenario: RSI 初始化方式与图表一致
- **WHEN** `computeRsi` 计算 RSI
- **THEN** 使用数组前 `period` 个元素初始化 avgGain/avgLoss（而非后 `period` 个）
- **THEN** 首条 RSI 有效值位于索引 `period`（与 `buildRsi` 一致）
- **THEN** 零增益零损失时返回 50（与 `computeRsiValue` 一致）
- **THEN** 最终结果与 `buildRsi(prices, 14)[prices.length - 1]` 数值一致
