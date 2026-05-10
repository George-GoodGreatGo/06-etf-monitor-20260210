export const BASELINE_ENHANCED_METHOD_PATH = '/market/rps/methodology'

export type BaselineEnhancedMethodSection = {
  title: string
  description: string
  bullets: string[]
}

export type BaselineEnhancedBacktestRow = {
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

export const BASELINE_ENHANCED_SUMMARY_LINES = [
  '默认主图箭头已切换到 Baseline加强风控策略：买点要求绿转黄且收盘价不低于 SMA250。',
  '卖点包含五层递进保护：硬止损-7%、ATR-3x 自适应止损、trailing12% 追踪、close<SMA250 年线破位、confirm 确认卖出。',
  '硬止损或 ATR-3x 触发卖出后，10 个交易日内不会因假翻黄重新入场（冷却机制）。',
] as const

export const BASELINE_ENHANCED_METHOD_SECTIONS: BaselineEnhancedMethodSection[] = [
  {
    title: '策略定位',
    description: 'Baseline加强风控策略在 Baseline策略的基础上，新增硬止损、ATR 自适应止损和冷却机制，目标是在保持原版收益水平的前提下，进一步降低趋势末端的尾部风险和假翻黄带来的磨损。',
    bullets: [
      '硬止损-7%确保入场后一旦方向判断错误，浮亏不超过 7%。',
      'ATR-3x(14) 提供波动自适应的暴跌保护，不用等 -12% 追踪追上。',
      '10 日冷却防止硬止损或 ATR 切出后被假翻黄重新带入。',
      'trailing12% 保留原版的宽追踪，继续给利润充分的奔跑空间。',
    ],
  },
  {
    title: '指标定义',
    description: '本策略在原有 Baseline 指标基础上新增 ATR(14)，用于自适应止损判断。',
    bullets: [
      'Score 分区：绿<0、黄=0~10、橙=10~20、红>20（沿用）。',
      'SMA20、SMA250 用于趋势和确认卖出判断。',
      'MACD 采用 (8,21,5)，RSI 采用 14 日窗口。',
      'ATR(14) 基于 OHLC 的真实波幅计算（True Range = max(H-L, |H-prevC|, |L-prevC|)），取 14 日 SMA，用于 ATR-3x 止损阈值。',
    ],
  },
  {
    title: '买入规则',
    description: '买入规则与 Baseline策略完全一致。',
    bullets: [
      '前一交易日价格分段颜色为绿（Score < 0），当日转为黄（Score ∈ [0, 10]）。',
      '当日收盘价 ≥ SMA250，确认价格处于中长期趋势之上。',
      '满足上述两条后，在主图标记买入箭头。',
      '若前一笔卖出为硬止损或 ATR-3x，且距卖出日 ≤ 10 个交易日，则跳过本次翻黄（冷却期内不入场）。',
    ],
  },
  {
    title: '卖出规则',
    description: '卖出端采用五层递进保护体系，按优先级依次判断。',
    bullets: [
      '第一层·硬止损-7%：持仓浮亏达到 7%，无条件离场。',
      '第二层·ATR-3x(14)：当日收盘价 ≤ 持仓以来最高收盘价 − 3 × ATR(14)，自适应暴跌保护。',
      '第三层·trailing12%：当日收盘价 ≤ 持仓以来最高收盘价 × 0.88。',
      '第四层·close<SMA250：收盘价跌破年线，离场。',
      '第五层·confirm 确认卖出：前一日黄、当日绿，且满足 close<SMA20 / MACD Hist<0 / RSI<50 任一。',
    ],
  },
  {
    title: '冷却机制',
    description: '针对 V6.1 回测中发现的 whipsaw（止损后假翻黄导致重复亏损）问题，引入 10 日冷却。',
    bullets: [
      '触发条件：通过硬止损-7% 或 ATR-3x 出场的持仓。',
      '生效逻辑：出场后的 10 个交易日内，即使 Score 翻黄，也不标记买入箭头。',
      '释放：10 日后自动解除。',
      '不触发冷却的退出方式：trailing12%、confirm 卖出、close<SMA250，不影响后续入场。',
      '设计意图：防止市场急跌后短暂反弹骗入，等市场稳定后再判断趋势。',
    ],
  },
  {
    title: '边界条件',
    description: '以下边界用于解释为什么某些日期不会出现箭头。',
    bullets: [
      '若当日缺失 SMA250、SMA20、MACD、RSI 或 ATR 所需历史窗口，则对应条件不成立。',
      '同一轮持仓未发生买入前，不会计算硬止损、ATR 或 trailing 止损。',
      '若已持仓，系统按优先级依次判断，第一个满足的条件触发卖出。',
      '冷却期内如果 Score 翻黄，图上不标记买入，策略层面禁止入场。',
    ],
  },
  {
    title: '实现口径',
    description: '本页方法说明与页面样本表格基于 V6.1 同口径回测结果。',
    bullets: [
      '样本回测数据来自 debug 研究归档 `debug/momentumCT12vsV51.ts`。',
      '表格选取 confirmTrail12 和 V6.1 同口径对比结果中的 V6.1 列。',
      '所有样本 ETF 使用统一的回测区间 2016-01-04 ~ 2026-05-09。',
    ],
  },
] as const

export const BASELINE_ENHANCED_BACKTEST_SOURCE =
  '研究样本来自 debug/momentumCT12vsV51.ts 中 V6.1 策略与 confirmTrail12 同口径对比结果。'

export const BASELINE_ENHANCED_BACKTEST_AGGREGATE = {
  avgTotalReturnPct: 104.96,
  avgCagrPct: 12.57,
  avgMaxDrawdownPct: 17.53,
  avgTrades: 13.8,
  avgWinRatePct: 53.17,
  avgHoldDays: 20.06,
  avgExposurePct: 17.27,
} as const

export const BASELINE_ENHANCED_BACKTEST_ROWS: BaselineEnhancedBacktestRow[] = [
  {
    ticker: '159915.SZ',
    name: '创业板ETF',
    sampleRange: '2016-01-04 ~ 2026-05-09',
    totalReturnPct: 162.42,
    cagrPct: 10.18,
    maxDrawdownPct: 14.23,
    trades: 26,
    winRatePct: 42.31,
    avgHoldDays: 21.54,
    exposurePct: 24.22,
  },
  {
    ticker: '588000.SH',
    name: '科创50ETF',
    sampleRange: '2020-11-16 ~ 2026-05-09',
    totalReturnPct: 59.19,
    cagrPct: 9.24,
    maxDrawdownPct: 18.72,
    trades: 9,
    winRatePct: 66.67,
    avgHoldDays: 19.56,
    exposurePct: 14.56,
  },
  {
    ticker: '159781.SZ',
    name: '科创创业ETF',
    sampleRange: '2021-07-05 ~ 2026-05-09',
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
    sampleRange: '2019-06-12 ~ 2026-05-09',
    totalReturnPct: 43.23,
    cagrPct: 5.56,
    maxDrawdownPct: 21.61,
    trades: 17,
    winRatePct: 41.18,
    avgHoldDays: 12.76,
    exposurePct: 15.12,
  },
  {
    ticker: '159869.SZ',
    name: '游戏ETF',
    sampleRange: '2021-03-05 ~ 2026-05-09',
    totalReturnPct: 127.0,
    cagrPct: 17.92,
    maxDrawdownPct: 16.18,
    trades: 8,
    winRatePct: 50,
    avgHoldDays: 24.88,
    exposurePct: 15.88,
  },
] as const
