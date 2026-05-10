# Baseline加强风控策略 Spec

## Why
V6.1 策略（基于 confirmTrail12，新增硬止损-7%、ATR-3x 自适应止损、10 日冷却机制）的回测结果显示：在同口径下平均 CAGR 12.57% vs ct12 原版 12.21%，平均回撤 17.53% vs 17.93%，三项指标均优于原版。现将该策略命名为「Baseline加强风控」并接入产品，作为「动量分析」和「ETF200列表」的默认策略。

## What Changes
- 新增 `baselineEnhanced` 策略（ID），注册到策略体系
- 将 `baselineEnhanced` 设为默认策略（替代 `confirmTrail12` 的默认位置）
- 在「动量分析」页面，该策略的主图展示「买」「卖」「风控卖」信号标记（逻辑同现有策略架构）
- 在「分析方法」页面，新增该策略的介绍和回测报告，使用与 confirmTrail12 同样的时间区间
- 在「ETF200列表」页面，该策略作为默认选项，展示各 ETF 的交易信号和新鲜度
- 新增 ATR(14) 指标计算（基于收盘价序列的日间波幅近似），补充到 `PreparedPoint` 和 `PreparedMomentumPoint` 类型中，供 V6.1 策略的图表标记和信号快照使用
- **BREAKING**: 默认策略从 `confirmTrail12` 切换为 `baselineEnhanced`

## Impact
- Affected specs: `add-confirmtrail12-method-and-momentum-signals`
- Affected code:
  - `src/utils/momentumStrategies.ts` — 策略注册表，新增策略定义，修改默认值
  - `src/utils/baselineEnhancedMethodology.ts` — **新建**，方法论与回测数据
  - `src/components/charts/RpsCustomQueryCharts.tsx` — 新增 V6.1 图表标记函数，PreparedPoint 增加 atr14
  - `src/utils/momentumSignalSnapshot.ts` — PreparedMomentumPoint 增加 atr14，新增 V6.1 信号事件计算
  - `src/pages/Home.tsx` — 默认策略切换（通过 resolveMomentumStrategyId 默认值）
  - `src/pages/MarketRpsMethodology.tsx` — 无需改动，策略注册表自动驱动

## ADDED Requirements

### Requirement: Baseline加强风控策略注册
系统 SHALL 将 `baselineEnhanced` 策略注册到统一策略体系，作为默认策略。

#### Scenario: 策略定义
- **WHEN** 策略元数据被加载
- **THEN** 策略 ID 为 `baselineEnhanced`
- **THEN** 用户可见名称为「Baseline加强风控」
- **THEN** 角色标签为「默认策略」
- **THEN** signalPreset 为 `baselineEnhanced`
- **THEN** 默认策略 ID 从 `confirmTrail12` 变更为 `baselineEnhanced`

#### Scenario: 策略选择器展示
- **WHEN** 用户在「动量分析」或「ETF200列表」页面查看策略选择器
- **THEN** 「Baseline加强风控」出现在选项列表中，标注「默认策略」
- **THEN** 「Baseline策略」的标签从「默认策略」变更为无标签或保留为可见选项

### Requirement: 动量分析页 V6.1 信号标记
系统 SHALL 在「动量分析」主图上，当选择「Baseline加强风控」策略时，展示符合 V6.1 规则的买卖点信号。

#### Scenario: 买入标记
- **WHEN** 前一日 Score 为绿（<0），当日转为黄（0~10），且当日收盘价 ≥ SMA250
- **THEN** 主图上在当日价格位置标记红色向上箭头「买」
- **THEN** 不触发 10 日冷却——冷却仅作用于卖出后重新入场，而此标记展示的是实际发生事件

#### Scenario: 确认卖出标记
- **WHEN** 前一日 Score 为黄，当日转为绿，且满足 close<SMA20 / MACD Hist<0 / RSI<50 任一
- **THEN** 主图上标记绿色向下箭头「卖」
- **THEN** 点击可查看触发原因

#### Scenario: 风控卖出标记（硬止损-7%）
- **WHEN** 持仓浮亏达到 7%
- **THEN** 主图上标记金色向下箭头「风控卖」
- **THEN** 点击弹窗显示「硬止损-7%：持仓浮亏达到 7%，触发强制止损」

#### Scenario: 风控卖出标记（ATR-3x）
- **WHEN** 当日收盘价 ≤ 持仓以来最高收盘价 − 3 × ATR(14)
- **THEN** 主图上标记金色向下箭头「风控卖」
- **THEN** 点击弹窗显示「ATR-3x止损：收盘价较最高点跌幅超过 3 倍 ATR」

#### Scenario: 风控卖出标记（trailing12%）
- **WHEN** 当日收盘价 ≤ 持仓以来最高收盘价 × 0.88
- **THEN** 主图上标记金色向下箭头「风控卖」
- **THEN** 点击弹窗显示「12%回撤风控：持仓后相对高点回撤达到 12%」

#### Scenario: 风控卖出标记（close<SMA250）
- **WHEN** 当日收盘价 < SMA250
- **THEN** 主图上标记金色向下箭头「风控卖」
- **THEN** 点击弹窗显示「年线破位：收盘价跌破 SMA250」

#### Scenario: 10 日冷却不显示额外标记
- **WHEN** 某笔持仓通过硬止损或 ATR-3x 卖出后，10 个交易日内 Score 翻黄
- **THEN** 主图上**不**标记买入箭头（策略层面禁止入场）
- **THEN** 冷却释放后，下次合法的绿转黄方可标记「买」

### Requirement: ATR(14) 指标增加
系统 SHALL 在前端和信号计算中新增 ATR(14) 指标，供 V6.1 策略使用。

#### Scenario: PreparedPoint 增加 atr14
- **WHEN** 图表组件构建 prepared 数据
- **THEN** `PreparedPoint` 类型包含 `atr14: number | null` 字段
- **THEN** ATR 基于收盘价的日间真实波幅近似计算（因图表 API 仅返回收盘价，不含 high/low）

#### Scenario: PreparedMomentumPoint 增加 atr14
- **WHEN** momentumSignalSnapshot 准备信号计算点
- **THEN** `PreparedMomentumPoint` 类型包含 `atr14: number | null` 字段
- **THEN** 采用相同近似方法计算

### Requirement: ETF200 列表 V6.1 信号快照
系统 SHALL 在「ETF200列表」页面，当选择「Baseline加强风控」策略时，使用 V6.1 逻辑计算各 ETF 的交易信号快照。

#### Scenario: 信号快照计算
- **WHEN** 前端计算信号快照（`computeMomentumSignalSnapshot` 传入 `signalPreset === 'baselineEnhanced'`）
- **THEN** 使用 V6.1 的买卖和退出逻辑（硬止损-7%、ATR-3x、trailing12%、confirm、SMA250）
- **THEN** 取价格序列中最后一次发生的事件作为快照
- **THEN** 信号键值使用 `buy` / `sell` / `risk_sell`

#### Scenario: 10 日冷却在快照中体现
- **WHEN** 最后一笔事件为风险卖出（硬止损或 ATR-3x），且当前日期距卖出日 ≤ 10 个交易日
- **THEN** 穿越到当前日期时，冷却期内不记录新的买入
- **THEN** 若冷却期内有假翻黄，不生成新信号

#### Scenario: 信号新鲜度
- **WHEN** 信号日期距参考日期的交易日天数确定
- **THEN** 当天 / 3日内 / 5日内 / 其它，逻辑与现有策略相同

### Requirement: 分析方法页 V6.1 策略说明
系统 SHALL 在「分析方法」页面为「Baseline加强风控」策略提供完整的方法说明和回测报告。

#### Scenario: 方法页内容
- **WHEN** 用户访问 `分析方法` 页面并选择「Baseline加强风控」
- **THEN** 页面展示策略定位、指标定义、买入规则、卖出规则（包含硬止损-7%、ATR-3x、分级追踪、confirm、SMA250）、冷却机制、边界条件、实现口径
- **THEN** 展示与 Baseline策略相同的 5 只样本 ETF 的回测结果表格
- **THEN** 回测区间标注为 `2016-01-04 ~ 2026-05-09`

#### Scenario: 回测汇总数据
- **WHEN** 用户查看回测汇总
- **THEN** 展示 V6.1 同口径对比数据：平均总收益 104.96%、平均 CAGR 12.57%、平均最大回撤 17.53%

#### Scenario: 回测逐 ETF 数据
- **WHEN** 用户查看回测表格
- **THEN** 列出 159915/588000/159781/512480/159869 五只 ETF 的总收益、CAGR、最大回撤、交易次数、胜率等指标

## MODIFIED Requirements

### Requirement: 默认策略从 confirmTrail12 变更为 baselineEnhanced
**Reason**: V6.1 在同口径下回报更高、回撤略低
**Migration**: `DEFAULT_MOMENTUM_STRATEGY_ID` 从 `'confirmTrail12'` 改为 `'baselineEnhanced'`；原有 `confirmTrail12` 保留为可选项，标签去除「默认策略」

### Requirement: 策略 ID 枚举扩展
**Reason**: 新增 `baselineEnhanced` 策略需要注册到类型系统和守卫函数中
**Migration**: `MomentumStrategyId` 新增 `'baselineEnhanced'`；`isMomentumStrategyId` 函数新增对该值的识别
