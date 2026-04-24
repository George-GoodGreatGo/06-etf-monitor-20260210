import { fetchEastmoneyDailyKline } from '../lib/eastmoneyKline.js'
import { fetchLowVolIndexCloseSeries } from '../lib/lowVol.js'

type Tone = 'negative' | 'neutral' | 'positive' | 'strong'
type MacdBuyMode = 'none' | 'bull' | 'bull_rising'
type MacdSellMode = 'none' | 'diff_bear' | 'bear'

type Bar = {
  date: string
  open: number
  close: number
  scorePct: number | null
  sma20: number | null
  sma60: number | null
  sma250: number | null
  rsi14: number | null
  macdDiff: number | null
  macdDea: number | null
  macdHist: number | null
  tone: Tone
}

type StrategyConfig = {
  id: string
  buyMacdMode: MacdBuyMode
  buyRsiMin: number
  buyRsiMax: number
  sellMacdMode: MacdSellMode
  sellRsiMax: number
  sellNegativeDays: number
  forceSellBelowSma250: boolean
  buyAboveSma20?: boolean
  buyAboveSma60?: boolean
  buySma20AboveSma60?: boolean
  sellBelowSma20?: boolean
  sellBelowSma60?: boolean
  sellSma20BelowSma60?: boolean
  isBaseline?: boolean
}

type TradeRecord = {
  entryDate: string
  entryPrice: number
  exitDate: string
  exitPrice: number
  returnPct: number
  holdDays: number
}

type BacktestResult = {
  ticker: string
  strategyId: string
  totalReturnPct: number
  cagrPct: number
  maxDrawdownPct: number
  tradeActions: number
  roundTrips: number
  winRatePct: number
  avgHoldDays: number
  exposurePct: number
  finalEquity: number
  trades: TradeRecord[]
}

const START_DATE = '2016-01-01'
const END_DATE = new Date().toISOString().slice(0, 10)
const TICKERS = ['159915', '513120', '562550']
const TRADE_COST_RATE = 0.0005

function normalizeYmd10(raw: string): string {
  const s = String(raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return ''
}

function tickerToNormalized(tickerRaw: string): string {
  const raw = String(tickerRaw || '').trim().toUpperCase()
  if (/^\d{6}\.(SH|SZ)$/.test(raw)) return raw
  if (/^\d{6}$/.test(raw)) {
    const first = raw[0]
    if (first === '5' || first === '6' || first === '9') return `${raw}.SH`
    return `${raw}.SZ`
  }
  throw new Error(`bad ticker: ${tickerRaw}`)
}

function tickerToSecid(ticker: string): string {
  const [code, ex] = ticker.split('.')
  if (ex === 'SH') return `1.${code}`
  if (ex === 'SZ') return `0.${code}`
  throw new Error(`bad ticker exchange: ${ticker}`)
}

function buildSma(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

function buildEma(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length < window) return out
  let sum = 0
  for (let i = 0; i < window; i += 1) sum += values[i]
  let ema = sum / window
  out[window - 1] = ema
  const multiplier = 2 / (window + 1)
  for (let i = window; i < values.length; i += 1) {
    ema = (values[i] - ema) * multiplier + ema
    out[i] = ema
  }
  return out
}

function buildMacd(values: number[], shortPeriod: number, longPeriod: number, signalPeriod: number) {
  const shortEma = buildEma(values, shortPeriod)
  const longEma = buildEma(values, longPeriod)
  const out = values.map(() => ({ diff: null as number | null, dea: null as number | null, hist: null as number | null }))
  const diffValues = values.map((_, index) => {
    const shortValue = shortEma[index]
    const longValue = longEma[index]
    if (typeof shortValue !== 'number' || !Number.isFinite(shortValue)) return null
    if (typeof longValue !== 'number' || !Number.isFinite(longValue)) return null
    return shortValue - longValue
  })
  const multiplier = 2 / (Math.max(1, Math.floor(signalPeriod)) + 1)
  let dea: number | null = null
  for (let i = 0; i < diffValues.length; i += 1) {
    const diff = diffValues[i]
    if (typeof diff !== 'number' || !Number.isFinite(diff)) continue
    dea = dea == null ? diff : (diff - dea) * multiplier + dea
    out[i] = { diff, dea, hist: diff - dea }
  }
  return out
}

function computeRsiValue(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50
  if (avgLoss === 0) return 100
  if (avgGain === 0) return 0
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function buildRsi(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length <= window) return out

  let gains = 0
  let losses = 0
  for (let i = 1; i <= window; i += 1) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }
  let avgGain = gains / window
  let avgLoss = losses / window
  out[window] = computeRsiValue(avgGain, avgLoss)

  for (let i = window + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (window - 1) + gain) / window
    avgLoss = (avgLoss * (window - 1) + loss) / window
    out[i] = computeRsiValue(avgGain, avgLoss)
  }

  return out
}

function resolvePriceTone(score: number | null | undefined): Tone {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'neutral'
  if (score < 0) return 'negative'
  if (score <= 10) return 'neutral'
  if (score <= 20) return 'positive'
  return 'strong'
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function diffCalendarDays(aYmd10: string, bYmd10: string): number {
  const a = Date.parse(`${aYmd10}T00:00:00Z`)
  const b = Date.parse(`${bYmd10}T00:00:00Z`)
  return Math.round((a - b) / 86_400_000)
}

async function loadBars(tickerRaw: string): Promise<Bar[]> {
  const ticker = tickerToNormalized(tickerRaw)
  const [klineRows, benchmarkRows] = await Promise.all([
    fetchEastmoneyDailyKline({
      secid: tickerToSecid(ticker),
      beg: START_DATE.replace(/-/g, ''),
      end: END_DATE.replace(/-/g, ''),
    }),
    fetchLowVolIndexCloseSeries({
      code: 'H30269',
      kind: 'pri',
      startDate8: START_DATE.replace(/-/g, ''),
      endDate8: END_DATE.replace(/-/g, ''),
    }),
  ])

  const priceMap = new Map<string, { open: number; close: number }>()
  for (const row of klineRows) {
    const date = normalizeYmd10(row.date)
    if (!date) continue
    if (!Number.isFinite(row.open) || !Number.isFinite(row.close)) continue
    priceMap.set(date, { open: row.open, close: row.close })
  }

  const benchmarkMap = new Map<string, number>()
  for (const row of benchmarkRows) {
    const date = normalizeYmd10(row.date)
    const close = typeof row.close === 'number' && Number.isFinite(row.close) ? row.close : null
    if (!date || close == null || close <= 0) continue
    benchmarkMap.set(date, close)
  }

  const aligned = Array.from(priceMap.entries())
    .map(([date, price]) => {
      const benchmarkClose = benchmarkMap.get(date)
      if (typeof benchmarkClose !== 'number' || !Number.isFinite(benchmarkClose) || benchmarkClose <= 0) return null
      return {
        date,
        open: price.open,
        close: price.close,
        rpsRaw: price.close / benchmarkClose,
      }
    })
    .filter((row): row is { date: string; open: number; close: number; rpsRaw: number } => Boolean(row))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const rpsRawValues = aligned.map((row) => row.rpsRaw)
  const rpsMa50 = buildSma(rpsRawValues, 50)
  const scoreValues = aligned.map((row, index) => {
    const ma50 = rpsMa50[index]
    if (typeof ma50 !== 'number' || !Number.isFinite(ma50) || ma50 === 0) return null
    return ((row.rpsRaw / ma50) - 1) * 100
  })
  const closes = aligned.map((row) => row.close)
  const sma20 = buildSma(closes, 20)
  const sma60 = buildSma(closes, 60)
  const sma250 = buildSma(closes, 250)
  const rsi14 = buildRsi(closes, 14)
  const macd = buildMacd(closes, 8, 21, 5)

  return aligned.map((row, index) => ({
    date: row.date,
    open: row.open,
    close: row.close,
    scorePct: scoreValues[index] ?? null,
    sma20: sma20[index] ?? null,
    sma60: sma60[index] ?? null,
    sma250: sma250[index] ?? null,
    rsi14: rsi14[index] ?? null,
    macdDiff: macd[index]?.diff ?? null,
    macdDea: macd[index]?.dea ?? null,
    macdHist: macd[index]?.hist ?? null,
    tone: resolvePriceTone(scoreValues[index] ?? null),
  }))
}

function passBuyMacd(bar: Bar, prevBar: Bar | null, mode: MacdBuyMode): boolean {
  if (mode === 'none') return true
  const diff = bar.macdDiff
  const dea = bar.macdDea
  const hist = bar.macdHist
  if (typeof diff !== 'number' || typeof dea !== 'number' || typeof hist !== 'number') return false
  if (!(diff > dea && hist > 0)) return false
  if (mode === 'bull') return true
  const prevHist = prevBar?.macdHist
  return typeof prevHist === 'number' && hist > prevHist
}

function passSellMacd(bar: Bar, mode: MacdSellMode): boolean {
  if (mode === 'none') return true
  const diff = bar.macdDiff
  const dea = bar.macdDea
  const hist = bar.macdHist
  if (typeof diff !== 'number' || typeof dea !== 'number') return false
  if (mode === 'diff_bear') return diff < dea
  return diff < dea && typeof hist === 'number' && hist < 0
}

function buildStrategyId(cfg: Omit<StrategyConfig, 'id'>): string {
  return [
    `buyMacd=${cfg.buyMacdMode}`,
    `buyRsi=${cfg.buyRsiMin}-${cfg.buyRsiMax}`,
    `sellMacd=${cfg.sellMacdMode}`,
    `sellRsi<=${cfg.sellRsiMax}`,
    `negDays=${cfg.sellNegativeDays}`,
    `smaStop=${cfg.forceSellBelowSma250 ? 'on' : 'off'}`,
  ].join('|')
}

function buildCandidateStrategies(): StrategyConfig[] {
  const candidates: StrategyConfig[] = []
  const buyMacdModes: MacdBuyMode[] = ['bull', 'bull_rising']
  const buyRsiMins = [50, 55, 60]
  const buyRsiMaxs = [70, 75, 80]
  const sellMacdModes: MacdSellMode[] = ['none', 'diff_bear', 'bear']
  const sellRsiMaxs = [45, 50, 55]
  const sellNegativeDaysList = [1, 2]
  const smaStops = [true, false]

  for (const buyMacdMode of buyMacdModes) {
    for (const buyRsiMin of buyRsiMins) {
      for (const buyRsiMax of buyRsiMaxs) {
        if (buyRsiMax <= buyRsiMin) continue
        for (const sellMacdMode of sellMacdModes) {
          for (const sellRsiMax of sellRsiMaxs) {
            for (const sellNegativeDays of sellNegativeDaysList) {
              for (const forceSellBelowSma250 of smaStops) {
                const base = {
                  buyMacdMode,
                  buyRsiMin,
                  buyRsiMax,
                  sellMacdMode,
                  sellRsiMax,
                  sellNegativeDays,
                  forceSellBelowSma250,
                }
                candidates.push({
                  id: buildStrategyId(base),
                  ...base,
                })
              }
            }
          }
        }
      }
    }
  }

  return candidates
}

function buildBaselineStrategy(): StrategyConfig {
  return {
    id: 'baseline',
    buyMacdMode: 'none',
    buyRsiMin: 0,
    buyRsiMax: 100,
    sellMacdMode: 'none',
    sellRsiMax: 100,
    sellNegativeDays: 1,
    forceSellBelowSma250: false,
    buyAboveSma20: false,
    buyAboveSma60: false,
    buySma20AboveSma60: false,
    sellBelowSma20: false,
    sellBelowSma60: false,
    sellSma20BelowSma60: false,
    isBaseline: true,
  }
}

function buildRecommendedStrategy(): StrategyConfig {
  return {
    id: 'buyMacd=bull|buyRsi=50-75|sellMacd=diff_bear|sellRsi<=45|negDays=2|smaStop=on',
    buyMacdMode: 'bull',
    buyRsiMin: 50,
    buyRsiMax: 75,
    sellMacdMode: 'diff_bear',
    sellRsiMax: 45,
    sellNegativeDays: 2,
    forceSellBelowSma250: true,
    buyAboveSma20: false,
    buyAboveSma60: false,
    buySma20AboveSma60: false,
    sellBelowSma20: false,
    sellBelowSma60: false,
    sellSma20BelowSma60: false,
  }
}

function withStrategyId(strategy: StrategyConfig, id: string): StrategyConfig {
  return { ...strategy, id }
}

function buildSmaEnhancedStrategies(base: StrategyConfig): StrategyConfig[] {
  return [
    withStrategyId(base, 'recommended'),
    withStrategyId({ ...base, buyAboveSma20: true }, 'recommended+buy_above_sma20'),
    withStrategyId({ ...base, buyAboveSma60: true }, 'recommended+buy_above_sma60'),
    withStrategyId({ ...base, buySma20AboveSma60: true }, 'recommended+buy_sma20_gt_sma60'),
    withStrategyId(
      { ...base, buyAboveSma20: true, buySma20AboveSma60: true },
      'recommended+buy_above_sma20+buy_sma20_gt_sma60',
    ),
    withStrategyId({ ...base, sellBelowSma20: true }, 'recommended+sell_below_sma20'),
    withStrategyId({ ...base, sellBelowSma60: true }, 'recommended+sell_below_sma60'),
    withStrategyId({ ...base, sellSma20BelowSma60: true }, 'recommended+sell_sma20_lt_sma60'),
    withStrategyId(
      { ...base, buyAboveSma20: true, buySma20AboveSma60: true, sellBelowSma20: true },
      'recommended+buy_sma_confirm+sell_below_sma20',
    ),
    withStrategyId(
      { ...base, buyAboveSma60: true, buySma20AboveSma60: true, sellBelowSma60: true },
      'recommended+buy_sma60_confirm+sell_below_sma60',
    ),
  ]
}

function backtestBars(ticker: string, bars: Bar[], strategy: StrategyConfig): BacktestResult {
  if (bars.length < 3) throw new Error(`not enough bars: ${ticker}`)
  let cash = 1
  let shares = 0
  let inPosition = false
  let scheduledBuy = false
  let scheduledSell = false
  let entryDate = ''
  let entryPrice = 0
  let entryIndex = -1
  let negativeStreak = 0
  let exposureDays = 0
  let tradeActions = 0
  const trades: TradeRecord[] = []
  const equities: number[] = []

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]
    const prevBar = i > 0 ? bars[i - 1] : null
    const nextBar = i + 1 < bars.length ? bars[i + 1] : null

    if (scheduledBuy && !inPosition) {
      shares = (cash * (1 - TRADE_COST_RATE)) / bar.open
      cash = 0
      inPosition = true
      scheduledBuy = false
      tradeActions += 1
      entryDate = bar.date
      entryPrice = bar.open
      entryIndex = i
    }

    if (scheduledSell && inPosition) {
      cash = shares * bar.open * (1 - TRADE_COST_RATE)
      shares = 0
      inPosition = false
      scheduledSell = false
      tradeActions += 1
      trades.push({
        entryDate,
        entryPrice,
        exitDate: bar.date,
        exitPrice: bar.open,
        returnPct: (((bar.open / entryPrice) * (1 - TRADE_COST_RATE) * (1 - TRADE_COST_RATE)) - 1) * 100,
        holdDays: entryIndex >= 0 ? i - entryIndex : 0,
      })
      entryDate = ''
      entryPrice = 0
      entryIndex = -1
    }

    if (bar.tone === 'negative') negativeStreak += 1
    else negativeStreak = 0

    if (inPosition) exposureDays += 1
    equities.push(inPosition ? shares * bar.close : cash)

    if (!nextBar) continue

    const prevTone = prevBar?.tone ?? null
    const buyEvent = prevTone === 'negative' && bar.tone === 'neutral'
    const sellEvent = prevTone === 'neutral' && bar.tone === 'negative'
    const rsi = bar.rsi14
    const aboveSma250 = typeof bar.sma250 === 'number' && Number.isFinite(bar.sma250) && bar.close >= bar.sma250
    const aboveSma20 = typeof bar.sma20 === 'number' && Number.isFinite(bar.sma20) && bar.close >= bar.sma20
    const aboveSma60 = typeof bar.sma60 === 'number' && Number.isFinite(bar.sma60) && bar.close >= bar.sma60
    const sma20AboveSma60 =
      typeof bar.sma20 === 'number' && Number.isFinite(bar.sma20) && typeof bar.sma60 === 'number' && Number.isFinite(bar.sma60) && bar.sma20 >= bar.sma60

    if (!inPosition && !scheduledBuy) {
      const passRsi = strategy.isBaseline
        ? true
        : typeof rsi === 'number' &&
          Number.isFinite(rsi) &&
          rsi >= strategy.buyRsiMin &&
          rsi <= strategy.buyRsiMax
      const passMacd = strategy.isBaseline ? true : passBuyMacd(bar, prevBar, strategy.buyMacdMode)
      const passSma20 = strategy.isBaseline || !strategy.buyAboveSma20 || aboveSma20
      const passSma60 = strategy.isBaseline || !strategy.buyAboveSma60 || aboveSma60
      const passSmaAlignment = strategy.isBaseline || !strategy.buySma20AboveSma60 || sma20AboveSma60
      if (buyEvent && aboveSma250 && passRsi && passMacd && passSma20 && passSma60 && passSmaAlignment) {
        scheduledBuy = true
      }
    }

    if (inPosition && !scheduledSell) {
      if (strategy.isBaseline) {
        if (sellEvent) scheduledSell = true
        continue
      }
      const belowSma250 =
        strategy.forceSellBelowSma250 &&
        typeof bar.sma250 === 'number' &&
        Number.isFinite(bar.sma250) &&
        bar.close < bar.sma250
      const belowSma20 =
        strategy.sellBelowSma20 &&
        typeof bar.sma20 === 'number' &&
        Number.isFinite(bar.sma20) &&
        bar.close < bar.sma20
      const belowSma60 =
        strategy.sellBelowSma60 &&
        typeof bar.sma60 === 'number' &&
        Number.isFinite(bar.sma60) &&
        bar.close < bar.sma60
      const sma20BelowSma60 =
        strategy.sellSma20BelowSma60 &&
        typeof bar.sma20 === 'number' &&
        Number.isFinite(bar.sma20) &&
        typeof bar.sma60 === 'number' &&
        Number.isFinite(bar.sma60) &&
        bar.sma20 < bar.sma60
      const passRsi = typeof rsi === 'number' && Number.isFinite(rsi) && rsi <= strategy.sellRsiMax
      const passMacd = passSellMacd(bar, strategy.sellMacdMode)
      const toneConfirmed = bar.tone === 'negative' && negativeStreak >= strategy.sellNegativeDays
      if (belowSma250 || belowSma20 || belowSma60 || sma20BelowSma60 || (toneConfirmed && passRsi && passMacd)) {
        scheduledSell = true
      }
    }
  }

  const finalEquity = inPosition ? shares * bars[bars.length - 1].close : cash
  const maxDrawdownPct = computeMaxDrawdownPct(equities)
  const firstDate = bars[0].date
  const lastDate = bars[bars.length - 1].date
  const years = Math.max(1 / 365, diffCalendarDays(lastDate, firstDate) / 365)
  const cagrPct = (Math.pow(finalEquity, 1 / years) - 1) * 100
  const wins = trades.filter((trade) => trade.exitPrice > trade.entryPrice).length
  const avgHoldDays = trades.length ? trades.reduce((sum, trade) => sum + trade.holdDays, 0) / trades.length : 0
  return {
    ticker,
    strategyId: strategy.id,
    totalReturnPct: (finalEquity - 1) * 100,
    cagrPct,
    maxDrawdownPct,
    tradeActions,
    roundTrips: trades.length,
    winRatePct: trades.length ? (wins / trades.length) * 100 : 0,
    avgHoldDays,
    exposurePct: (exposureDays / bars.length) * 100,
    finalEquity,
    trades,
  }
}

function computeMaxDrawdownPct(equities: number[]): number {
  let peak = 0
  let maxDd = 0
  for (const equity of equities) {
    if (equity > peak) peak = equity
    if (peak <= 0) continue
    const dd = (equity / peak - 1) * 100
    if (dd < maxDd) maxDd = dd
  }
  return maxDd
}

function averageMetric(results: BacktestResult[], pick: (result: BacktestResult) => number): number {
  if (!results.length) return 0
  return results.reduce((sum, item) => sum + pick(item), 0) / results.length
}

function formatResultRow(result: BacktestResult) {
  return {
    ticker: result.ticker,
    strategy: result.strategyId,
    totalReturnPct: roundTo(result.totalReturnPct),
    cagrPct: roundTo(result.cagrPct),
    maxDrawdownPct: roundTo(result.maxDrawdownPct),
    roundTrips: result.roundTrips,
    tradeActions: result.tradeActions,
    winRatePct: roundTo(result.winRatePct),
    avgHoldDays: roundTo(result.avgHoldDays, 1),
    exposurePct: roundTo(result.exposurePct),
  }
}

async function main() {
  const available: Array<readonly [string, Bar[]]> = []
  const unavailable: Array<{ ticker: string; reason: string }> = []
  for (const ticker of TICKERS) {
    try {
      const bars = await loadBars(ticker)
      if (bars.length < 3) throw new Error(`not enough bars: ${bars.length}`)
      available.push([ticker, bars] as const)
    } catch (error) {
      unavailable.push({
        ticker,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (!available.length) throw new Error('no available tickers for backtest')
  const activeTickers = available.map(([ticker]) => ticker)
  const barsByTicker = Object.fromEntries(available)

  const baselineStrategy = buildBaselineStrategy()
  const baselineResults = activeTickers.map((ticker) => backtestBars(ticker, barsByTicker[ticker], baselineStrategy))
  const baselineSummary = {
    avgTotalReturnPct: roundTo(averageMetric(baselineResults, (item) => item.totalReturnPct)),
    avgCagrPct: roundTo(averageMetric(baselineResults, (item) => item.cagrPct)),
    avgMaxDrawdownPct: roundTo(averageMetric(baselineResults, (item) => item.maxDrawdownPct)),
    avgRoundTrips: roundTo(averageMetric(baselineResults, (item) => item.roundTrips), 1),
  }

  const candidates = buildCandidateStrategies()
  const evaluated = candidates.map((candidate) => {
    const results = activeTickers.map((ticker) => backtestBars(ticker, barsByTicker[ticker], candidate))
    return {
      candidate,
      results,
      avgTotalReturnPct: averageMetric(results, (item) => item.totalReturnPct),
      avgCagrPct: averageMetric(results, (item) => item.cagrPct),
      avgMaxDrawdownPct: averageMetric(results, (item) => item.maxDrawdownPct),
      avgRoundTrips: averageMetric(results, (item) => item.roundTrips),
      avgExposurePct: averageMetric(results, (item) => item.exposurePct),
    }
  })

  const baselineAvgRoundTrips = averageMetric(baselineResults, (item) => item.roundTrips)
  const baselineAvgCagr = averageMetric(baselineResults, (item) => item.cagrPct)
  const baselineAvgMaxDd = averageMetric(baselineResults, (item) => item.maxDrawdownPct)

  const qualified = evaluated.filter(
    (item) =>
      item.avgRoundTrips <= baselineAvgRoundTrips * 0.75 &&
      item.avgCagrPct >= baselineAvgCagr - 2 &&
      item.avgMaxDrawdownPct >= baselineAvgMaxDd - 5,
  )

  const bestCompromise = [...(qualified.length ? qualified : evaluated)].sort((a, b) => {
    if (b.avgCagrPct !== a.avgCagrPct) return b.avgCagrPct - a.avgCagrPct
    if (a.avgRoundTrips !== b.avgRoundTrips) return a.avgRoundTrips - b.avgRoundTrips
    return b.avgMaxDrawdownPct - a.avgMaxDrawdownPct
  })[0]

  const lowFrictionTop = [...evaluated]
    .sort((a, b) => {
      if (a.avgRoundTrips !== b.avgRoundTrips) return a.avgRoundTrips - b.avgRoundTrips
      if (b.avgCagrPct !== a.avgCagrPct) return b.avgCagrPct - a.avgCagrPct
      return b.avgMaxDrawdownPct - a.avgMaxDrawdownPct
    })
    .slice(0, 10)
    .map((item) => ({
      strategy: item.candidate.id,
      avgTotalReturnPct: roundTo(item.avgTotalReturnPct),
      avgCagrPct: roundTo(item.avgCagrPct),
      avgMaxDrawdownPct: roundTo(item.avgMaxDrawdownPct),
      avgRoundTrips: roundTo(item.avgRoundTrips, 1),
      avgExposurePct: roundTo(item.avgExposurePct),
    }))

  const bestRows = bestCompromise.results.map(formatResultRow)
  const recommendedStrategy = buildRecommendedStrategy()
  const smaEnhanced = buildSmaEnhancedStrategies(recommendedStrategy).map((candidate) => {
    const results = activeTickers.map((ticker) => backtestBars(ticker, barsByTicker[ticker], candidate))
    return {
      strategy: candidate.id,
      avgTotalReturnPct: roundTo(averageMetric(results, (item) => item.totalReturnPct)),
      avgCagrPct: roundTo(averageMetric(results, (item) => item.cagrPct)),
      avgMaxDrawdownPct: roundTo(averageMetric(results, (item) => item.maxDrawdownPct)),
      avgRoundTrips: roundTo(averageMetric(results, (item) => item.roundTrips), 1),
      avgExposurePct: roundTo(averageMetric(results, (item) => item.exposurePct)),
      rows: results.map(formatResultRow),
    }
  })

  console.log(JSON.stringify(
    {
      meta: {
        startDate: START_DATE,
        endDate: END_DATE,
        tickers: TICKERS,
        activeTickers,
        tradeCostRatePerSide: TRADE_COST_RATE,
        note: '信号基于当日收盘确认，交易按下一交易日开盘价执行；买入仅允许在收盘价>=SMA250时触发。',
      },
      unavailable,
      baseline: {
        summary: baselineSummary,
        rows: baselineResults.map(formatResultRow),
      },
      bestCompromise: {
        strategy: bestCompromise.candidate.id,
        summary: {
          avgTotalReturnPct: roundTo(bestCompromise.avgTotalReturnPct),
          avgCagrPct: roundTo(bestCompromise.avgCagrPct),
          avgMaxDrawdownPct: roundTo(bestCompromise.avgMaxDrawdownPct),
          avgRoundTrips: roundTo(bestCompromise.avgRoundTrips, 1),
          avgExposurePct: roundTo(bestCompromise.avgExposurePct),
        },
        rows: bestRows,
      },
      smaEnhanced,
      lowFrictionTop,
    },
    null,
    2,
  ))
}

await main()
