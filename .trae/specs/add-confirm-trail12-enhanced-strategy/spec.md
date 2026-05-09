# Baseline增强风控 策略 Spec

## Why
回测迭代（V1→V6.1）表明，在原版 confirmTrail12（Baseline策略）基础上新增硬止损-7%、ATR-3x(14) 自适应止损和 10 日冷却期，可以在不牺牲平均收益（CAGR 12.57% vs 原版 12.21%）的前提下增强风控能力。现将该策略沉淀为正式策略——**"Baseline增强风控"**，并在动量分析页面、分析方法页和 ETF200 列表页中可选取和展示。

## What Changes
- 新增 MomentumStrategyId `'confirmTrail12Enhanced'`，label 为"Baseline增强风控"，设为**默认策略**
- 新建 `src/utils/confirmTrail12EnhancedMethodology.ts`，归档该策略的规则说明和 V6.1 回测数据
- 修改 `src/utils/momentumStrategies.ts`：注册新策略、调整 `DEFAULT_MOMENTUM_STRATEGY_ID`
- 修改 `src/utils/momentumSignalSnapshot.ts`：新增 `buildConfirmTrail12EnhancedEvents()` 信号计算函数
- 修改 `src/components/charts/RpsCustomQueryCharts.tsx`：新增 V6.1 图表信号标记渲染
- 现有 `baseColorFlip` 对照策略保持不变
- 现有 `confirmTrail12` 策略保留但不再作为默认
- **BREAKING**: 默认策略从 `confirmTrail12` 切换为 `confirmTrail12Enhanced`，影响动量分析页、分析方法页、ETF200 列表页的默认展示

## Impact
- Affected specs: `add-momentum-analysis-buy-sell-markers`, `add-confirmtrail12-method-and-momentum-signals`, `refactor-methodology-strategy-tabs`, `add-top200-momentum-signal-snapshot-columns`
- Affected code:
  - `src/utils/momentumStrategies.ts` — 策略注册表
  - `src/utils/momentumSignalSnapshot.ts` — 信号快照计算
  - `src/utils/confirmTrail12EnhancedMethodology.ts` — 新文件，策略元数据
  - `src/components/charts/RpsCustomQueryCharts.tsx` — 图表买卖标记
  - `src/components/RpsStylePanel.tsx` — 图例渲染（无需改，自动从策略定义读取）
  - `src/pages/Home.tsx` — ETF200 列表策略默认值
  - `src/pages/MarketRpsMethodology.tsx` — 分析方法页

## ADDED Requirements

### Requirement: Baseline增强风控 策略注册
系统 SHALL 在 `MOMENTUM_STRATEGIES` 中注册策略 `confirmTrail12Enhanced`，label 为"Baseline增强风控"。

#### Scenario: 策略选择器展示新策略
- **WHEN** 用户进入动量分析页
- **THEN** 策略选择器默认展示"Baseline增强风控"作为选中态，标签为"默认策略"
- **AND** 切换按钮组中包含"Baseline策略"、"基础颜色切换"、"Baseline增强风控"三个选项

### Requirement: 入场规则
系统 SHALL 沿用原版 confirmTrail12 入场规则：
- 前一交易日 Score 为绿（<0），当日转为黄（0~10）
- 当日收盘价 ≥ SMA250

#### Scenario: 绿转黄触发买点
- **WHEN** Score 从绿转黄且 close ≥ SMA250
- **THEN** 主图标记红色向上箭头"买"
- **AND** 开始记录持仓期内最高收盘价

### Requirement: 风控止损规则
系统 SHALL 在 confirmTrail12 确认卖出和 12% 追踪止损基础上，新增两道风控：

① **硬止损 -7%**：持仓浮亏 ≥ 7% 时立即卖出
② **ATR-3x(14) 自适应止损**：close ≤ highestClose - 3×ATR(14) 时卖出

#### Scenario: 硬止损触发
- **WHEN** 买入后浮动亏损达到 7%
- **THEN** 主图标记金色向下箭头"风控卖"
- **AND** 触发 10 日冷却期

#### Scenario: ATR 止损触发
- **WHEN** 当天收盘价 ≤ 持仓最高价 - 3×14日ATR
- **THEN** 主图标记金色向下箭头"风控卖"
- **AND** 触发 10 日冷却期

### Requirement: 10 日冷却期
系统 SHALL 在硬止损-7% 或 ATR-3x 触发卖出后，**10 个交易日内**禁止基于 Score 翻黄重新入场。

#### Scenario: 冷却期阻止 whipsaw
- **WHEN** ATR-3x 触发卖出后 10 日内 Score 再次绿转黄
- **THEN** 系统跳过本次入场信号，不标记买点

#### Scenario: 冷却期过期后正常入场
- **WHEN** ATR-3x 触发卖出后第 11 个交易日 Score 绿转黄
- **THEN** 系统正常入场并标记买点

### Requirement: 分级追踪止损
系统 SHALL 保留原版 confirmTrail12 的 -12% 追踪止损（不变），并在浮盈 ≥ 12% 后将追踪收紧至 -8%（原版固定 -12%）。

#### Scenario: 浮盈达标后收紧追踪
- **WHEN** 持仓浮盈 ≥ 12%
- **THEN** 追踪止损从 -12% 收紧为 -8%
- **AND** 触发时标记为"风控卖"

### Requirement: 分析方法页
系统 SHALL 在 `/market/rps/methodology?strategy=confirmTrail12Enhanced` 展示"Baseline增强风控"的方法论页，包含：
- 策略定位、指标定义、买入规则、卖出规则、增强风控、边界条件、实现口径七章
- 汇总回测数据卡片（平均总收益、平均 CAGR、平均最大回撤）
- 5 只样本 ETF 逐行回测表格

#### Scenario: 分析方法页展示回测数据
- **WHEN** 用户访问分析方法页且当前策略为"Baseline增强风控"
- **THEN** 显示使用 V6.1 同口径数据（2016-01-01 ~ 2026-05-09，5 ETF 平均总收益 104.96%、平均 CAGR 12.57%、平均最大回撤 17.53%）的回测汇总和逐行表格

### Requirement: ETF200 列表策略选项
系统 SHALL 在 ETF200 列表页的策略筛选器中默认选中"Baseline增强风控"，并展示该策略的：
- 各 ETF 的最新交易信号（买/卖/风控卖）和新鲜度
- 信号类型为 `buy`、`sell`、`risk_sell` 三种

#### Scenario: ETF200 列表默认展示增强风控信号
- **WHEN** 用户进入首页 ETF200 列表
- **THEN** 策略筛选器默认选中"Baseline增强风控"
- **AND** 表格中每只 ETF 展示该策略计算的最新交易信号

## MODIFIED Requirements

### Requirement: 默认策略 ID
系统 SHALL 将 `DEFAULT_MOMENTUM_STRATEGY_ID` 从 `'confirmTrail12'` 修改为 `'confirmTrail12Enhanced'`。

### Requirement: 策略 ID 类型推断
系统 SHALL 在 `MomentumStrategyId` 联合类型中新增 `'confirmTrail12Enhanced'`，并在 `MomentumStrategySignalPreset` 中新增 `'confirmTrail12Enhanced'`。

### Requirement: 策略有效性校验
系统 SHALL 在 `isMomentumStrategyId()` 中新增 `'confirmTrail12Enhanced'` 的校验分支。
