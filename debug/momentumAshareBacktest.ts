import { writeFile } from 'node:fs/promises'

import { fetchEastmoneyDailyKline, fetchEastmoneyDailyKlineWithAmount } from '../server/lib/eastmoneyKline.ts'
import { fetchLowVolIndexCloseSeries } from '../server/lib/lowVol.ts'

type TickerProfile = {
  ticker: string
  name: string
}

type Tone = 'negative' | 'neutral' | 'positive' | 'strong'

type PriceBar = {
  date: string
  close: number
  amount: number | null
}

type PreparedBar = {
  date: string
  close: number
  scorePct: number | null
  sma20: number | null
  sma60: number | null
  sma250: number | null
  rsi14: number | null
  macdHist: number | null
  turnoverMultiple: number | null
}

type TradeRecord = {
  entryDate: string
  exitDate: string
  holdBars: number
  returnPct: number
}

type BacktestStats = {
  ticker: string
  name: string
  bars: number
  startDate: string
  endDate: string
  totalReturnPct: number
  cagrPct: number
  maxDrawdownPct: number
  trades: number
  winRatePct: number
  avgHoldDays: number
  exposurePct: number
}

type AggregateStats = {
  avgTotalReturnPct: number
  medianTotalReturnPct: number
  avgCagrPct: number
  avgMaxDrawdownPct: number
  avgTrades: number
  avgWinRatePct: number
  avgHoldDays: number
  avgExposurePct: number
}

type ConfigResult = {
  name: string
  exitMode: ExitMode
  entryFlags: EntryFlag[]
  aggregate: AggregateStats
  byTicker: BacktestStats[]
}

type EntryFlag =
  | 'close>=sma20'
  | 'sma20>=sma60'
  | 'sma60>=sma250'
  | 'macdHist>0'
  | 'rsi>=55'
  | 'rsi<=75'
  | 'recentVol5'

type ExitMode =
  | 'base'
  | 'confirm'
  | 'strict'
  | 'trendBreak'
  | 'confirmTrail10'
  | 'confirmTrail10Macd'
  | 'confirmTrail12'
  | 'confirmTrail10Sma20'

const START_DATE = '2016-01-01'
const END_DATE = '2026-04-24'
const BENCHMARK = 'H30269'
const FEE_RATE_PER_SIDE = 0.001
const RECENT_VOL_LOOKBACK = 5
const RECENT_VOL_THRESHOLD = 1.5
const TRAILING_STOP_PCT = 0.1
const TRAILING_STOP_PCT_WIDE = 0.12

const SAMPLE_TICKERS: TickerProfile[] = [
  { ticker: '159915.SZ', name: '创业板ETF' },
  { ticker: '588000.SH', name: '科创50ETF' },
  { ticker: '159781.SZ', name: '科创创业ETF' },
  { ticker: '512480.SH', name: '半导体ETF' },
  { ticker: '159869.SZ', name: '游戏ETF' },
]

const ENTRY_FLAGS: EntryFlag[] = [
  'close>=sma20',
  'sma20>=sma60',
  'sma60>=sma250',
  'macdHist>0',
  'rsi>=55',
  'rsi<=75',
  'recentVol5',
]

const EXIT_MODES: ExitMode[] = [
  'base',
  'confirm',
  'strict',
  'trendBreak',
  'confirmTrail10',
  'confirmTrail10Macd',
  'confirmTrail12',
  'confirmTrail10Sma20',
]

function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** Math.max(0, digits)
  return Math.round(value * factor) / factor
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildSma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (!values.length || period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function buildEma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  const window = Math.max(1, Math.floor(period))
  if (!values.length) return out
  const multiplier = 2 / (window + 1)
  let ema: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    ema = ema == null ? value : (value - ema) * multiplier + ema
    out[i] = ema
  }
  return out
}

function buildMacd(
  values: number[],
  shortPeriod: number,
  longPeriod: number,
  signalPeriod: number,
): Array<{ diff: number | null; dea: number | null; hist: number | null }> {
  const shortEma = buildEma(values, shortPeriod)
  const longEma = buildEma(values, longPeriod)
  const out = values.map(() => ({ diff: null, dea: null, hist: null }))
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

function ymd8(ymd10: string): string {
  return ymd10.replace(/-/g, '')
}

function tickerToSecid(ticker: string): string {
  const [code, exchange] = ticker.split('.')
  return `${exchange === 'SH' ? '1' : '0'}.${code}`
}

function resolveTone(score: number | null | undefined): Tone {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'neutral'
  if (score < 0) return 'negative'
  if (score <= 10) return 'neutral'
  if (score <= 20) return 'positive'
  return 'strong'
}

function buildTurnoverMultiple(values: Array<number | null>, lookback = 20): Array<number | null> {
  return values.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    if (index < lookback) return null
    const window = values.slice(index - lookback, index)
    if (window.some((item) => typeof item !== 'number' || !Number.isFinite(item))) return null
    const avg = (window as number[]).reduce((sum, item) => sum + item, 0) / lookback
    if (!Number.isFinite(avg) || avg <= 0) return null
    return value / avg
  })
}

async function fetchBenchmarkSeries(): Promise<Array<{ date: string; close: number }>> {
  const rows = await fetchLowVolIndexCloseSeries({
    code: BENCHMARK,
    kind: 'pri',
    startDate8: ymd8(START_DATE),
    endDate8: ymd8(END_DATE),
  })
  return rows
    .filter((row) => typeof row.close === 'number' && Number.isFinite(row.close))
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchTickerBars(profile: TickerProfile): Promise<PriceBar[]> {
  const [priceRows, amountRows] = await Promise.all([
    fetchEastmoneyDailyKline({
      secid: tickerToSecid(profile.ticker),
      beg: ymd8(START_DATE),
      end: ymd8(END_DATE),
    }),
    fetchEastmoneyDailyKlineWithAmount({
      secid: tickerToSecid(profile.ticker),
      beg: ymd8(START_DATE),
      end: ymd8(END_DATE),
    }),
  ])
  const amountMap = new Map(amountRows.map((row) => [row.date, row.amount ?? null]))
  return priceRows
    .map((row) => ({
      date: row.date,
      close: row.close,
      amount: amountMap.get(row.date) ?? null,
    }))
    .filter((row) => Number.isFinite(row.close))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function prepareBars(
  priceBars: PriceBar[],
  benchmarkSeries: Array<{ date: string; close: number }>,
): PreparedBar[] {
  const benchmarkMap = new Map(benchmarkSeries.map((row) => [row.date, row.close]))
  const alignedBars = priceBars.filter((bar) => {
    const benchmarkClose = benchmarkMap.get(bar.date)
    return typeof benchmarkClose === 'number' && Number.isFinite(benchmarkClose) && benchmarkClose > 0
  })
  const closes = alignedBars.map((bar) => bar.close)
  const amounts = alignedBars.map((bar) => bar.amount)
  const rpsValues = alignedBars.map((bar) => bar.close / (benchmarkMap.get(bar.date) as number))
  const rpsMa50 = buildSma(rpsValues, 50)
  const sma20 = buildSma(closes, 20)
  const sma60 = buildSma(closes, 60)
  const sma250 = buildSma(closes, 250)
  const rsi14 = buildRsi(closes, 14)
  const macd = buildMacd(closes, 8, 21, 5)
  const turnoverMultiple = buildTurnoverMultiple(amounts, 20)

  return alignedBars.map((bar, index) => {
    const ma50 = rpsMa50[index]
    const scorePct = typeof ma50 === 'number' && Number.isFinite(ma50) && ma50 !== 0 ? (rpsValues[index] / ma50 - 1) * 100 : null
    return {
      date: bar.date,
      close: bar.close,
      scorePct,
      sma20: sma20[index] ?? null,
      sma60: sma60[index] ?? null,
      sma250: sma250[index] ?? null,
      rsi14: rsi14[index] ?? null,
      macdHist: macd[index]?.hist ?? null,
      turnoverMultiple: turnoverMultiple[index] ?? null,
    }
  })
}

function hasRecentVolumeBreakout(bars: PreparedBar[], index: number): boolean {
  const start = Math.max(0, index - RECENT_VOL_LOOKBACK + 1)
  for (let i = start; i <= index; i += 1) {
    const value = bars[i]?.turnoverMultiple
    if (typeof value === 'number' && Number.isFinite(value) && value >= RECENT_VOL_THRESHOLD) return true
  }
  return false
}

function passesEntryFlags(bars: PreparedBar[], index: number, flags: EntryFlag[]): boolean {
  const bar = bars[index]
  if (!bar) return false
  return flags.every((flag) => {
    switch (flag) {
      case 'close>=sma20':
        return typeof bar.sma20 === 'number' && bar.close >= bar.sma20
      case 'sma20>=sma60':
        return typeof bar.sma20 === 'number' && typeof bar.sma60 === 'number' && bar.sma20 >= bar.sma60
      case 'sma60>=sma250':
        return typeof bar.sma60 === 'number' && typeof bar.sma250 === 'number' && bar.sma60 >= bar.sma250
      case 'macdHist>0':
        return typeof bar.macdHist === 'number' && bar.macdHist > 0
      case 'rsi>=55':
        return typeof bar.rsi14 === 'number' && bar.rsi14 >= 55
      case 'rsi<=75':
        return typeof bar.rsi14 === 'number' && bar.rsi14 <= 75
      case 'recentVol5':
        return hasRecentVolumeBreakout(bars, index)
      default:
        return true
    }
  })
}

function isBaseEntry(prevBar: PreparedBar, bar: PreparedBar): boolean {
  const prevTone = resolveTone(prevBar.scorePct)
  const tone = resolveTone(bar.scorePct)
  return prevTone === 'negative' && tone === 'neutral' && typeof bar.sma250 === 'number' && bar.close >= bar.sma250
}

function isBaseExit(prevBar: PreparedBar, bar: PreparedBar): boolean {
  const prevTone = resolveTone(prevBar.scorePct)
  const tone = resolveTone(bar.scorePct)
  return prevTone === 'neutral' && tone === 'negative'
}

function shouldExit(prevBar: PreparedBar, bar: PreparedBar, mode: ExitMode): boolean {
  if (mode === 'base') return isBaseExit(prevBar, bar)

  const closeBelowSma20 = typeof bar.sma20 === 'number' && bar.close < bar.sma20
  const macdNegative = typeof bar.macdHist === 'number' && bar.macdHist < 0
  const rsiBelow50 = typeof bar.rsi14 === 'number' && bar.rsi14 < 50
  const confirms = [closeBelowSma20, macdNegative, rsiBelow50].filter(Boolean).length

  if (
    (mode === 'trendBreak' ||
      mode === 'confirmTrail10' ||
      mode === 'confirmTrail10Macd' ||
      mode === 'confirmTrail12' ||
      mode === 'confirmTrail10Sma20') &&
    typeof bar.sma250 === 'number' &&
    bar.close < bar.sma250
  ) {
    return true
  }
  if (!isBaseExit(prevBar, bar)) return false
  if (mode === 'confirm') return confirms >= 1
  if (mode === 'strict') return confirms >= 2
  if (mode === 'trendBreak') return confirms >= 1
  if (mode === 'confirmTrail10') return confirms >= 1
  if (mode === 'confirmTrail10Macd') return confirms >= 1
  if (mode === 'confirmTrail12') return confirms >= 1
  if (mode === 'confirmTrail10Sma20') return confirms >= 1
  return false
}

function calcMaxDrawdown(equityCurve: number[]): number {
  let peak = Number.NEGATIVE_INFINITY
  let maxDrawdown = 0
  for (const equity of equityCurve) {
    if (!Number.isFinite(equity)) continue
    if (equity > peak) peak = equity
    if (peak > 0) {
      const drawdown = (peak - equity) / peak
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }
  }
  return maxDrawdown * 100
}

function backtestTicker(profile: TickerProfile, bars: PreparedBar[], flags: EntryFlag[], exitMode: ExitMode): BacktestStats {
  let cash = 1
  let positionUnits = 0
  let entryIndex = -1
  let entryEquity = 0
  let highestCloseSinceEntry = 0
  let exposureBars = 0
  const trades: TradeRecord[] = []
  const equityCurve: number[] = []

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]
    const prevBar = i > 0 ? bars[i - 1] : null

    if (positionUnits > 0) {
      exposureBars += 1
      if (bar.close > highestCloseSinceEntry) highestCloseSinceEntry = bar.close
    }

    if (prevBar && positionUnits === 0 && isBaseEntry(prevBar, bar) && passesEntryFlags(bars, i, flags)) {
      const buyCash = cash * (1 - FEE_RATE_PER_SIDE)
      positionUnits = buyCash / bar.close
      cash = 0
      entryIndex = i
      entryEquity = buyCash
      highestCloseSinceEntry = bar.close
    } else if (prevBar && positionUnits > 0) {
      const hitTrailingStop =
        exitMode === 'confirmTrail10' &&
        highestCloseSinceEntry > 0 &&
        bar.close <= highestCloseSinceEntry * (1 - TRAILING_STOP_PCT)
      const hitTrailingStopWithMacd =
        exitMode === 'confirmTrail10Macd' &&
        highestCloseSinceEntry > 0 &&
        bar.close <= highestCloseSinceEntry * (1 - TRAILING_STOP_PCT) &&
        typeof bar.macdHist === 'number' &&
        bar.macdHist < 0
      const hitTrailingStopWide =
        exitMode === 'confirmTrail12' &&
        highestCloseSinceEntry > 0 &&
        bar.close <= highestCloseSinceEntry * (1 - TRAILING_STOP_PCT_WIDE)
      const hitTrailingStopWithSma20 =
        exitMode === 'confirmTrail10Sma20' &&
        highestCloseSinceEntry > 0 &&
        bar.close <= highestCloseSinceEntry * (1 - TRAILING_STOP_PCT) &&
        typeof bar.sma20 === 'number' &&
        bar.close < bar.sma20
      if (!hitTrailingStop && !hitTrailingStopWithMacd && !hitTrailingStopWide && !hitTrailingStopWithSma20 && !shouldExit(prevBar, bar, exitMode)) {
        const equity = positionUnits > 0 ? positionUnits * bar.close : cash
        equityCurve.push(equity)
        continue
      }
      const gross = positionUnits * bar.close
      const net = gross * (1 - FEE_RATE_PER_SIDE)
      cash = net
      positionUnits = 0
      trades.push({
        entryDate: bars[entryIndex].date,
        exitDate: bar.date,
        holdBars: Math.max(1, i - entryIndex),
        returnPct: entryEquity > 0 ? (net / entryEquity - 1) * 100 : 0,
      })
      entryIndex = -1
      entryEquity = 0
      highestCloseSinceEntry = 0
    }

    const equity = positionUnits > 0 ? positionUnits * bar.close : cash
    equityCurve.push(equity)
  }

  if (positionUnits > 0) {
    const lastBar = bars[bars.length - 1]
    const gross = positionUnits * lastBar.close
    const net = gross * (1 - FEE_RATE_PER_SIDE)
    cash = net
    trades.push({
      entryDate: bars[entryIndex].date,
      exitDate: lastBar.date,
      holdBars: Math.max(1, bars.length - 1 - entryIndex),
      returnPct: entryEquity > 0 ? (net / entryEquity - 1) * 100 : 0,
    })
    positionUnits = 0
    highestCloseSinceEntry = 0
    equityCurve[equityCurve.length - 1] = net
  }

  const startDate = bars[0]?.date ?? START_DATE
  const endDate = bars[bars.length - 1]?.date ?? END_DATE
  const totalReturnPct = (cash - 1) * 100
  const years = Math.max(1 / 252, bars.length / 252)
  const cagrPct = (Math.pow(Math.max(cash, 0), 1 / years) - 1) * 100
  const wins = trades.filter((trade) => trade.returnPct > 0).length
  const avgHoldDays = trades.length ? trades.reduce((sum, trade) => sum + trade.holdBars, 0) / trades.length : 0
  const exposurePct = bars.length ? (exposureBars / bars.length) * 100 : 0

  return {
    ticker: profile.ticker,
    name: profile.name,
    bars: bars.length,
    startDate,
    endDate,
    totalReturnPct: roundTo(totalReturnPct, 2),
    cagrPct: roundTo(cagrPct, 2),
    maxDrawdownPct: roundTo(calcMaxDrawdown(equityCurve), 2),
    trades: trades.length,
    winRatePct: roundTo(trades.length ? (wins / trades.length) * 100 : 0, 2),
    avgHoldDays: roundTo(avgHoldDays, 2),
    exposurePct: roundTo(exposurePct, 2),
  }
}

function aggregateStats(stats: BacktestStats[]): AggregateStats {
  return {
    avgTotalReturnPct: roundTo(stats.reduce((sum, item) => sum + item.totalReturnPct, 0) / stats.length, 2),
    medianTotalReturnPct: roundTo(median(stats.map((item) => item.totalReturnPct)), 2),
    avgCagrPct: roundTo(stats.reduce((sum, item) => sum + item.cagrPct, 0) / stats.length, 2),
    avgMaxDrawdownPct: roundTo(stats.reduce((sum, item) => sum + item.maxDrawdownPct, 0) / stats.length, 2),
    avgTrades: roundTo(stats.reduce((sum, item) => sum + item.trades, 0) / stats.length, 2),
    avgWinRatePct: roundTo(stats.reduce((sum, item) => sum + item.winRatePct, 0) / stats.length, 2),
    avgHoldDays: roundTo(stats.reduce((sum, item) => sum + item.avgHoldDays, 0) / stats.length, 2),
    avgExposurePct: roundTo(stats.reduce((sum, item) => sum + item.exposurePct, 0) / stats.length, 2),
  }
}

function buildConfigName(flags: EntryFlag[], exitMode: ExitMode): string {
  if (!flags.length && exitMode === 'base') return 'baseline'
  return `entry:${flags.join('+') || 'none'}|exit:${exitMode}`
}

function buildConfigResults(seriesByTicker: Record<string, { profile: TickerProfile; bars: PreparedBar[] }>): ConfigResult[] {
  const out: ConfigResult[] = []
  for (const exitMode of EXIT_MODES) {
    for (let mask = 0; mask < 2 ** ENTRY_FLAGS.length; mask += 1) {
      const entryFlags = ENTRY_FLAGS.filter((_, index) => Boolean(mask & (1 << index)))
      const byTicker = Object.values(seriesByTicker).map(({ profile, bars }) => backtestTicker(profile, bars, entryFlags, exitMode))
      out.push({
        name: buildConfigName(entryFlags, exitMode),
        exitMode,
        entryFlags,
        aggregate: aggregateStats(byTicker),
        byTicker,
      })
    }
  }
  return out
}

function sortByReturn(results: ConfigResult[]): ConfigResult[] {
  return [...results].sort((a, b) => {
    if (b.aggregate.avgTotalReturnPct !== a.aggregate.avgTotalReturnPct) {
      return b.aggregate.avgTotalReturnPct - a.aggregate.avgTotalReturnPct
    }
    return a.aggregate.avgTrades - b.aggregate.avgTrades
  })
}

function pickBalanced(results: ConfigResult[]): ConfigResult | null {
  let best: { score: number; result: ConfigResult } | null = null
  for (const result of results) {
    const agg = result.aggregate
    if (agg.avgTrades < 2) continue
    if (agg.avgTotalReturnPct <= 0) continue
    const score = agg.avgCagrPct + agg.avgWinRatePct * 0.18 - agg.avgMaxDrawdownPct * 0.45 - agg.avgTrades * 0.35
    if (!best || score > best.score) best = { score, result }
  }
  return best?.result ?? null
}

function pickLowFriction(results: ConfigResult[]): ConfigResult | null {
  let best: { score: number; result: ConfigResult } | null = null
  for (const result of results) {
    const agg = result.aggregate
    if (agg.avgTrades < 2 || agg.avgTrades > 8) continue
    if (agg.avgTotalReturnPct <= 0) continue
    const score = agg.avgWinRatePct * 0.3 + agg.avgCagrPct * 0.4 - agg.avgMaxDrawdownPct * 0.35 - agg.avgTrades * 0.25
    if (!best || score > best.score) best = { score, result }
  }
  return best?.result ?? null
}

async function main() {
  const benchmarkSeries = await fetchBenchmarkSeries()
  if (!benchmarkSeries.length) throw new Error(`benchmark series empty: ${BENCHMARK}`)

  const seriesEntries = await Promise.all(
    SAMPLE_TICKERS.map(async (profile) => {
      const rawBars = await fetchTickerBars(profile)
      const preparedBars = prepareBars(rawBars, benchmarkSeries)
      if (preparedBars.length === 0) throw new Error(`prepared bars empty: ${profile.ticker}`)
      return [profile.ticker, { profile, bars: preparedBars }] as const
    }),
  )

  const seriesByTicker = Object.fromEntries(seriesEntries)
  const results = buildConfigResults(seriesByTicker)
  const baseline = results.find((result) => result.name === 'baseline')
  if (!baseline) throw new Error('baseline result missing')

  const topByReturn = sortByReturn(results).slice(0, 12)
  const focusNames = [
    'entry:none|exit:confirm',
    'entry:none|exit:confirmTrail10',
    'entry:none|exit:confirmTrail10Macd',
    'entry:none|exit:confirmTrail12',
    'entry:none|exit:confirmTrail10Sma20',
  ]
  const focusComparisons = focusNames
    .map((name) => results.find((result) => result.name === name) ?? null)
    .filter((result): result is NonNullable<typeof result> => result != null)
  const balanced = pickBalanced(results)
  const lowFriction = pickLowFriction(results)

  const output = {
    meta: {
      startDate: START_DATE,
      endDate: END_DATE,
      benchmark: BENCHMARK,
      feeRatePerSide: FEE_RATE_PER_SIDE,
      recentVolumeLookback: RECENT_VOL_LOOKBACK,
      recentVolumeThreshold: RECENT_VOL_THRESHOLD,
      configsTested: results.length,
      tickers: SAMPLE_TICKERS.map((item) => ({ ticker: item.ticker, name: item.name })),
      notes: [
        'baseline=绿转黄且收盘价>=SMA250买入；黄转绿卖出',
        'score_tone=绿<0, 黄=0~10, 橙=10~20, 红>20',
        'MACD uses (8,21,5), RSI uses (14), turnoverMultiple=当日成交额/前20日均值',
        'exit:confirm=黄转绿且满足 close<SMA20 / MACD Hist<0 / RSI<50 任一',
        'exit:strict=黄转绿且满足上述三个条件中的至少两个',
        'exit:trendBreak=confirm 或 收盘价跌回 SMA250 下方',
        'exit:confirmTrail10=confirm 或 收盘价跌回 SMA250 下方，或持仓后相对高点回撤10%',
        'exit:confirmTrail10Macd=confirm 或 收盘价跌回 SMA250 下方，或持仓后相对高点回撤10%且MACD Hist<0',
        'exit:confirmTrail12=confirm 或 收盘价跌回 SMA250 下方，或持仓后相对高点回撤12%',
        'exit:confirmTrail10Sma20=confirm 或 收盘价跌回 SMA250 下方，或持仓后相对高点回撤10%且收盘价<SMA20',
      ],
    },
    baseline,
    highlights: {
      bestReturn: topByReturn[0] ?? null,
      balanced,
      lowFriction,
    },
    focusComparisons,
    topByReturn,
  }

  const outPath = new URL('./momentum_backtest_a_share_output.json', import.meta.url)
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log(`Wrote ${outPath.pathname}`)
  console.log(JSON.stringify(output.highlights, null, 2))
}

await main()
