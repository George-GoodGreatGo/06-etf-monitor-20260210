export const CONFIRM_TRAIL12_METHOD_PATH = '/market/rps/methodology'

export type ConfirmTrail12MethodSection = {
  title: string
  description: string
  bullets: string[]
}

export type ConfirmTrail12BacktestRow = {
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

export const CONFIRM_TRAIL12_SUMMARY_LINES = [
  '默认主图箭头已切换到 confirmTrail12：买点要求绿转黄且收盘价不低于 SMA250。',
  '确认卖点要求黄转绿后，同时满足 close<SMA20、MACD Hist<0、RSI<50 中任一条件。',
  '持仓后若收盘价相对本轮最高收盘价回撤达到 12%，则额外触发增强风控卖点。',
] as const

export const CONFIRM_TRAIL12_METHOD_SECTIONS: ConfirmTrail12MethodSection[] = [
  {
    title: '策略定位',
    description: 'confirmTrail12 用于把 RPS 风格切换信号落到单只 ETF 的顺势交易节奏上，核心目标是减少黄绿来回切换带来的噪声，同时保留趋势拐点的可读性。',
    bullets: [
      '买点只在价格重新回到中长期趋势之上时触发，避免弱势反抽误判。',
      '卖点拆成“确认卖出”和“12%增强风控卖出”两类，既保留趋势转弱确认，也保留持仓利润保护。',
      '页面默认展示的是给普通用户看的简化产品口径，强调可复核、可解释、可复用。',
    ],
  },
  {
    title: '指标定义',
    description: '页面沿用当前动量分析主图和副图中的同一批指标，避免说明页与图表口径不一致。',
    bullets: [
      'Score 分区继续使用现有四档着色：绿<0、黄=0~10、橙=10~20、红>20。',
      'SMA20、SMA60、SMA250 分别用于观察短、中、长周期趋势支撑。',
      'MACD 采用 (8,21,5)，RSI 采用 14 日窗口，放量倍数采用当日成交额 / 前 20 个交易日均值。',
    ],
  },
  {
    title: '买入规则',
    description: '默认买点聚焦“趋势回到可操作区”的那一刻，而不是所有颜色变化。',
    bullets: [
      '前一交易日价格分段颜色为绿，当日转为黄。',
      '当日收盘价 >= SMA250，确认价格仍处于中长期趋势之上。',
      '满足上述两条后，在主图标记买入箭头。',
    ],
  },
  {
    title: '卖出规则',
    description: '确认卖点要求趋势颜色重新转弱，并且至少出现一个短线恶化证据，减少单一信号误报。',
    bullets: [
      '前一交易日价格分段颜色为黄，当日转为绿。',
      '同时满足以下任一条件：close < SMA20，或 MACD Hist < 0，或 RSI < 50。',
      '满足后在主图标记确认卖点，用于提示趋势转弱已被短周期指标确认。',
    ],
  },
  {
    title: '增强风控',
    description: '12% trailing stop 用来保护持仓阶段已经形成的利润，也限制高波动 ETF 的深度回撤。',
    bullets: [
      '自买入后开始记录本轮持仓期间的最高收盘价。',
      '若某日收盘价相对该最高收盘价回撤达到 12%，即触发增强风控卖点。',
      '增强风控卖点与确认卖点在页面文案和标记文案上区分展示，便于用户理解卖出原因。',
    ],
  },
  {
    title: '边界条件',
    description: '以下边界用于解释为什么某些日期不会出现箭头，避免把缺失值误解为没有信号。',
    bullets: [
      '若当日缺失 SMA250、SMA20、MACD 或 RSI 所需历史窗口，则对应条件不成立，不触发该类信号。',
      '同一轮持仓未发生买入前，不会计算 12% 回撤风控。',
      '若已持仓，系统只记录第一类有效卖点，卖出后等待下一次新的买点再重新进入。',
    ],
  },
  {
    title: '实现口径',
    description: '本页方法说明与页面样本表格优先复用现有研究输出，方便后续直接沉淀到 PRD 或帮助文档。',
    bullets: [
      '样本回测数据来自仓库中的 debug 研究归档 `debug/momentum_backtest_a_share_output.json`。',
      '表格选取该文件中 `entry:none|exit:confirmTrail12` 的样本 ETF 结果，保留收益、回撤、交易次数、胜率和平均持有天数等核心字段。',
      '产品页简介只保留决策所需的最小规则，完整边界与样本结果统一放在本页归档。',
    ],
  },
] as const

export const CONFIRM_TRAIL12_BACKTEST_SOURCE =
  '研究样本来自 debug/momentum_backtest_a_share_output.json 中 entry:none|exit:confirmTrail12 组合。'

export const CONFIRM_TRAIL12_BACKTEST_AGGREGATE = {
  avgTotalReturnPct: 90.45,
  avgCagrPct: 10.92,
  avgMaxDrawdownPct: 17.93,
  avgTrades: 14.6,
  avgWinRatePct: 51.9,
  avgHoldDays: 21.28,
  avgExposurePct: 18.2,
} as const

export const CONFIRM_TRAIL12_BACKTEST_ROWS: ConfirmTrail12BacktestRow[] = [
  {
    ticker: '159915.SZ',
    name: '创业板ETF',
    sampleRange: '2016-01-04 ~ 2026-04-24',
    totalReturnPct: 159.4,
    cagrPct: 10.08,
    maxDrawdownPct: 17.7,
    trades: 27,
    winRatePct: 40.74,
    avgHoldDays: 24.41,
    exposurePct: 26.34,
  },
  {
    ticker: '588000.SH',
    name: '科创50ETF',
    sampleRange: '2020-11-16 ~ 2026-04-24',
    totalReturnPct: 39.86,
    cagrPct: 6.62,
    maxDrawdownPct: 17.25,
    trades: 10,
    winRatePct: 60,
    avgHoldDays: 20.8,
    exposurePct: 15.77,
  },
  {
    ticker: '159781.SZ',
    name: '科创创业ETF',
    sampleRange: '2021-07-05 ~ 2026-04-24',
    totalReturnPct: 116.32,
    cagrPct: 18.16,
    maxDrawdownPct: 16.9,
    trades: 9,
    winRatePct: 66.67,
    avgHoldDays: 20.78,
    exposurePct: 16.05,
  },
  {
    ticker: '512480.SH',
    name: '半导体ETF',
    sampleRange: '2019-06-12 ~ 2026-04-24',
    totalReturnPct: 21.77,
    cagrPct: 3.02,
    maxDrawdownPct: 21.61,
    trades: 19,
    winRatePct: 42.11,
    avgHoldDays: 13.89,
    exposurePct: 15.85,
  },
  {
    ticker: '159869.SZ',
    name: '游戏ETF',
    sampleRange: '2021-03-05 ~ 2026-04-24',
    totalReturnPct: 114.9,
    cagrPct: 16.73,
    maxDrawdownPct: 16.18,
    trades: 8,
    winRatePct: 50,
    avgHoldDays: 26.5,
    exposurePct: 17.01,
  },
] as const
