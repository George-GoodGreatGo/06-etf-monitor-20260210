export type ConfirmTrail12EnhancedMethodSection = {
  title: string
  description: string
  bullets: string[]
}

export type ConfirmTrail12EnhancedBacktestRow = {
  ticker: string
  name: string
  sampleRange: string
  totalReturnPct: number
  cagrPct: number
  maxDrawdownPct: number
  trades: number
  winRatePct: number
  avgHoldDays: number
  exposurePct: number
}

export const CONFIRM_TRAIL12_ENHANCED_SUMMARY_LINES = [
  'Baseline增强风控在 Baseline策略基础上新增硬止损-7%、ATR-3x(14) 自适应止损和 10 日冷却期。',
  '确认卖点、12% 追踪止损沿用 Baseline口径，浮盈≥12% 后追踪收紧至 8%。',
  '同口径回测下 CAGR 12.57% 与原版持平，同时增加了三道风控屏障。',
] as const

export const CONFIRM_TRAIL12_ENHANCED_METHOD_SECTIONS: ConfirmTrail12EnhancedMethodSection[] = [
  {
    title: '策略定位',
    description: 'Baseline增强风控在 Baseline策略（绿转黄入场 + 确认卖出 + 12% 追踪止损）的基础上，增加了三道风控机制，旨在不牺牲趋势收益的前提下提升回撤控制和假突破过滤能力。',
    bullets: [
      '入场规则与 Baseline策略完全一致：绿转黄且收盘价 ≥ SMA250，确保两种策略的买点可比较。',
      '卖出端新增硬止损-7% 和 ATR-3x(14) 自适应止损，在极端行情中更早离场。',
      'ATR 或硬止损触发后进入 10 日冷却期，防止 whipsaw（止损后立即被假信号重新拉回）。',
      '浮盈 ≥ 12% 后追踪止损从 -12% 收紧至 -8%，更主动地保护已实现利润。',
    ],
  },
  {
    title: '指标定义',
    description: '本策略沿用动量分析主图和副图中的同一批指标，并新增 ATR 作为风控判断依据。',
    bullets: [
      'Score 分区继续使用现有四档着色：绿<0、黄=0~10、橙=10~20、红>20。',
      'SMA20、SMA250 分别用于观察短、长周期趋势支撑。',
      'MACD 采用 (8,21,5)，RSI 采用 14 日窗口。',
      'ATR(14) 平均真实波幅用于自适应止损：当 close ≤ 持仓最高价 - 3×ATR 时触发离场。',
    ],
  },
  {
    title: '买入规则',
    description: '买入规则与 Baseline策略完全相同，不引入先行入场通道。',
    bullets: [
      '前一交易日价格分段颜色为绿，当日转为黄。',
      '当日收盘价 ≥ SMA250，确认价格仍处于中长期趋势之上。',
      '满足上述两条后，在主图标记红色向上买入箭头。',
      '注意：本策略不开放"先行入场"通道，所有买点严格按绿转黄触发。',
    ],
  },
  {
    title: '卖出规则 — 确认卖出',
    description: '确认卖点沿用 Baseline口径：趋势颜色重新转弱，且至少出现一个短线恶化证据。',
    bullets: [
      '前一交易日价格分段颜色为黄，当日转为绿。',
      '同时满足以下任一条件：close < SMA20，或 MACD Hist < 0，或 RSI < 50。',
      '满足后在主图标记绿色向下确认卖出箭头。',
    ],
  },
  {
    title: '卖出规则 — 硬止损 -7%',
    description: '硬止损-7% 是任何时点都生效的底线风控，旨在截断判断错误带来的尾部风险。',
    bullets: [
      '自买入后开始计算浮动盈亏（扣除单边费率）。',
      '若某日收盘时浮动亏损达到 7%，立即触发硬止损卖点。',
      '触发后在主图标记金色向下箭头"风控卖"。',
      '与 ATR 止损一样，触发后进入 10 日冷却期。',
    ],
  },
  {
    title: '卖出规则 — ATR-3x(14) 自适应止损',
    description: 'ATR-3x 利用波动率自适应地为每只 ETF 设定止损距离，高波动品种给更宽的空间，低波动品种更紧。',
    bullets: [
      '自买入后持续记录本轮持仓期间的最高收盘价。',
      '每日计算 14 日 ATR（真实波幅均值），当 close ≤ 持仓最高价 - 3×ATR 时触发离场。',
      '触发后在主图标记金色向下箭头"风控卖"。',
      '与硬止损-7% 一样，触发后进入 10 日冷却期。',
    ],
  },
  {
    title: '卖出规则 — 分级追踪止损',
    description: '追踪止损在 Baseline 的 -12% 基础上增加利润分级：浮盈越大，追踪越紧。',
    bullets: [
      '浮盈 < 5%：无额外追踪止损，仅依靠 hard stop 和 ATR 兜底。',
      '浮盈 5%~12%：-12% 追踪止损（与 Baseline 一致）。',
      '浮盈 ≥ 12%：追踪收紧至 -8%，更主动地锁定利润。',
      '触发后在主图标记金色向下箭头"风控卖"。',
    ],
  },
  {
    title: '10 日冷却期',
    description: '当硬止损-7% 或 ATR-3x 触发后，系统进入 10 日冷却期，期间即使 Score 再次翻黄也不入场。',
    bullets: [
      '冷却期从止损卖出当日开始计算，涵盖 10 个交易日。',
      '目的是防止 whipsaw——止损后价格短暂反弹骗入再被套。',
      '冷却期不影响确认退出和 12% 追踪止损触发的卖出（这两种退出不触发冷却）。',
      '冷却期满后，Score 绿转黄条件满足即可正常入场。',
    ],
  },
  {
    title: '边界条件',
    description: '以下边界用于解释为什么某些日期不会出现预期信号。',
    bullets: [
      '若当日缺失 SMA250、SMA20、MACD、RSI 或 ATR 所需历史窗口，则对应条件不成立，不触发该类信号。',
      '硬止损-7% 和 ATR-3x 触发后立即清仓并进入冷却，不允许同日重新入场。',
      '同一轮持仓中，系统只记录第一个有效卖点，卖出后等待买点再重新进入。',
      '冷却期内触发的 Score 翻黄信号不会在图表上产生买点标记。',
    ],
  },
  {
    title: '实现口径',
    description: '本策略方法说明与回测数据来自完整的 V6.1 回测研究归档，方便后续沉淀到产品文档。',
    bullets: [
      '样本回测数据来自仓库中的 debug 研究归档，区间为 2016-01-01 ~ 2026-05-09。',
      '复用 confirmTrail12 原版回测的对标口径：5 只样本 ETF、H30269 基准、单边 0.1% 费率。',
      '图表信号由前端根据 RPS 行情序列本地计算，策略切换实时生效。',
      'ETF200 列表中的信号快照由后端 API 预计算，各策略独立产出 signalKey/buy/sell/risk_sell。',
    ],
  },
] as const

export const CONFIRM_TRAIL12_ENHANCED_BACKTEST_SOURCE =
  '研究样本来自 debug/momentum_ct12_v6_v61_3way.json 中 V6.1 策略对应组合，区间 2016-01-01 ~ 2026-05-09。'

export const CONFIRM_TRAIL12_ENHANCED_BACKTEST_AGGREGATE = {
  avgTotalReturnPct: 104.96,
  avgCagrPct: 12.57,
  avgMaxDrawdownPct: 17.53,
  avgTrades: 13.8,
  avgWinRatePct: 53.37,
  avgHoldDays: 21.28,
  avgExposurePct: 17.23,
} as const

export const CONFIRM_TRAIL12_ENHANCED_BACKTEST_ROWS: ConfirmTrail12EnhancedBacktestRow[] = [
  {
    ticker: '159915.SZ',
    name: '创业板ETF',
    sampleRange: '2016-01-04 ~ 2026-05-08',
    totalReturnPct: 162.42,
    cagrPct: 10.18,
    maxDrawdownPct: 14.23,
    trades: 26,
    winRatePct: 42.31,
    avgHoldDays: 23.58,
    exposurePct: 24.43,
  },
  {
    ticker: '588000.SH',
    name: '科创50ETF',
    sampleRange: '2020-11-16 ~ 2026-05-08',
    totalReturnPct: 59.19,
    cagrPct: 9.24,
    maxDrawdownPct: 18.72,
    trades: 9,
    winRatePct: 66.67,
    avgHoldDays: 22.67,
    exposurePct: 15.38,
  },
  {
    ticker: '159781.SZ',
    name: '科创创业ETF',
    sampleRange: '2021-07-05 ~ 2026-05-08',
    totalReturnPct: 132.94,
    cagrPct: 19.94,
    maxDrawdownPct: 16.9,
    trades: 9,
    winRatePct: 66.67,
    avgHoldDays: 21.56,
    exposurePct: 16.55,
  },
  {
    ticker: '512480.SH',
    name: '半导体ETF',
    sampleRange: '2019-06-12 ~ 2026-05-08',
    totalReturnPct: 43.23,
    cagrPct: 5.56,
    maxDrawdownPct: 21.61,
    trades: 17,
    winRatePct: 41.18,
    avgHoldDays: 13.71,
    exposurePct: 13.93,
  },
  {
    ticker: '159869.SZ',
    name: '游戏ETF',
    sampleRange: '2021-03-05 ~ 2026-05-08',
    totalReturnPct: 127.0,
    cagrPct: 17.92,
    maxDrawdownPct: 16.18,
    trades: 8,
    winRatePct: 50.0,
    avgHoldDays: 24.88,
    exposurePct: 15.88,
  },
] as const
