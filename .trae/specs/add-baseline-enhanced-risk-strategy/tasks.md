# Tasks

- [x] Task 1: 新建 baselineEnhancedMethodology.ts 方法论文件
  - [x] 创建 `src/utils/baselineEnhancedMethodology.ts`
  - [x] 定义 SUMMARY_LINES、METHOD_SECTIONS（策略定位、指标定义、买入规则、卖出规则含硬止损/ATR/冷却、边界条件、实现口径）
  - [x] 定义 BACKTEST_AGGREGATE（avgTotalReturnPct: 104.96, avgCagrPct: 12.57, avgMaxDrawdownPct: 17.53, avgTrades: 13.8, avgWinRatePct: 53.17, avgHoldDays: 20.06, avgExposurePct: 17.27）
  - [x] 定义 BACKTEST_ROWS（5 只 ETF 逐行，使用同口径回测数据 2016-01-04 ~ 2026-05-09：创业板 162.42% / 科创50 59.19% / 科创创业 132.94% / 半导体 43.23% / 游戏 127.0%）
  - [x] 定义 BACKTEST_SOURCE

- [x] Task 2: 扩展策略注册表 momentumStrategies.ts
  - [x] MomentumStrategyId 新增 `'baselineEnhanced'`
  - [x] 新增 `baselineEnhanced` 策略定义（label: 'Baseline加强风控', shortLabel, roleLabel: '默认策略', signalPreset: 'baselineEnhanced', signalLegend 包含 buy/confirm-sell/risk-sell/turnover）
  - [x] `confirmTrail12` 的 roleLabel 改为 ''（去除默认标签）
  - [x] DEFAULT_MOMENTUM_STRATEGY_ID 改为 `'baselineEnhanced'`
  - [x] isMomentumStrategyId 函数新增 `'baselineEnhanced'` 识别

- [x] Task 3: PreparedPoint 和 PreparedMomentumPoint 增加 atr14 字段
  - [x] `RpsCustomQueryCharts.tsx` 中 PreparedPoint 类型新增 `atr14: number | null`
  - [x] prepared useMemo 中新增 ATR(14) 构建（基于收盘价的日间波幅近似：TR = |close[i] - close[i-1]|，取 14 日 SMA）
  - [x] `momentumSignalSnapshot.ts` 中 PreparedMomentumPoint 类型新增 `atr14: number | null`
  - [x] prepareMomentumPoints 函数中新增 ATR(14) 构建

- [x] Task 4: 图表标记 V6.1 逻辑
  - [x] `RpsCustomQueryCharts.tsx` 新增 `buildV61MarkerDetails` 函数
  - [x] 买入逻辑：绿转黄 + close>=SMA250 + 不在冷却期
  - [x] 硬止损-7%：持仓浮亏 >= 7%
  - [x] ATR-3x：close <= highestClose - 3*atr14
  - [x] trailing12%：close <= highestClose * 0.88
  - [x] close<SMA250
  - [x] confirm 卖出：黄转绿 + confirm
  - [x] 10 日冷却：ATR 或硬止损卖出后 blockUntilIndex = i+10
  - [x] buildTradeSignalMarkerDetails 中增加 `signalPreset === 'baselineEnhanced'` 分支
  - [x] Marker kind 使用 `buy` / `confirm-sell` / `risk-sell`，与 ct12 一致
  - [x] 风控卖点 reasonLines 按实际触发条件区分（硬止损/ATR/trailing/SMA250）

- [x] Task 5: 信号快照 V6.1 逻辑
  - [x] `momentumSignalSnapshot.ts` 新增 `buildBaselineEnhancedEvents` 函数
  - [x] 实现与 Task 4 相同逻辑，输出 `MomentumSignalEvent[]`
  - [x] buildTradeSignalEvents 中增加 `'baselineEnhanced'` 分支
  - [x] 10 日冷却：blockUntilIndex 机制

# Task Dependencies
- Task 2 depends on Task 1（策略定义引用方法论数据）
- Task 4 depends on Task 3（图表标记需要 atr14 字段）
- Task 5 depends on Task 3（信号快照需要 atr14 字段）
- Task 3 can be parallel with Task 1, Task 2
- Task 4 and Task 5 can be parallel
