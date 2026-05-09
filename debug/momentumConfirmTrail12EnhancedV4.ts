import { writeFile } from 'node:fs/promises'

import { fetchLowVolIndexCloseSeries } from '../server/lib/lowVol.ts'

type TickerProfile = {
  ticker: string
  name: string
}

type Tone = 'negative' | 'neutral' | 'positive' | 'strong'

type PriceBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  amount: number | null
}

type PreparedBar = {
  date: string
  close: number
  scorePct: number | null
  sma10: number | null
  sma20: number | null
  sma250: number | null
  rsi14: number | null
  macdDiff: number | null
  macdDea: number | null
  macdHist: number | null
  atr14: number | null
}

type TradeRecord = {
  entryDate: string
  exitDate: string
  exitReason: string
  entryType: string
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
  earlyEntries: number
  detailedTrades: TradeRecord[]
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
  totalEarlyEntries: number
}

const STRATEGY_NAME = 'confirmTrail12_V5.1_HardStop7_Trail8'
const START_DATE = '2016-01-01'
const END_DATE = '2026-05-09'
const BENCHMARK = 'H30269'
const FEE_RATE_PER_SIDE = 0.001
const HARD_STOP_PCT = 0.07
const TRAIL_PCT_MID = 0.10
const TRAIL_PCT_TIGHT = 0.08
const TRAIL_MID_FLOOR = 0.05
const TRAIL_TIGHT_FLOOR = 0.12
const ATR_MULTIPLIER = 3.0
const ATR_PERIOD = 14

const MACD_SHORT = 8
const MACD_LONG = 21
const MACD_SIGNAL = 5

const SAMPLE_TICKERS: TickerProfile[] = [
  { ticker: '159915.SZ', name: '创业板ETF' },
  { ticker: '588000.SH', name: '科创50ETF' },
  { ticker: '159781.SZ', name: '科创创业ETF' },
  { ticker: '512480.SH', name: '半导体ETF' },
  { ticker: '159869.SZ', name: '游戏ETF' },
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

function buildAtr(highs: number[], lows: number[], closes: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null)
  if (closes.length <= 1) return out

  const trValues: number[] = []
  for (let i = 0; i < closes.length; i += 1) {
    if (i === 0) {
      trValues.push(highs[i] - lows[i])
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      )
      trValues.push(tr)
    }
  }

  let sum = 0
  for (let i = 0; i < trValues.length; i += 1) {
    sum += trValues[i]
    if (i >= period) sum -= trValues[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function computeRsiValue(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50
  if (avgLoss === 0) return 100
  if (avgGain === 0) return 0
  return 100 - 100 / (1 + avgGain / avgLoss)
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

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
}

async function fetchTickerBars(profile: TickerProfile): Promise<PriceBar[]> {
  const secid = tickerToSecid(profile.ticker)
  const beg = ymd8(START_DATE)
  const end = ymd8(END_DATE)

  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  url.searchParams.set('secid', secid)
  url.searchParams.set('klt', '101')
  url.searchParams.set('fqt', '1')
  url.searchParams.set('beg', beg)
  url.searchParams.set('end', end)
  url.searchParams.set('fields1', 'f1,f2')
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f57')
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`eastmoney kline failed: HTTP ${res.status}`)
  const j = (await res.json().catch(() => null)) as { data?: { klines?: string[] } } | null
  const klines = Array.isArray(j?.data?.klines) ? j.data.klines : []

  const out: PriceBar[] = []
  for (const row of klines) {
    if (typeof row !== 'string') continue
    const parts = row.split(',')
    if (parts.length < 6) continue
    const date = String(parts[0] || '').trim()
    const open = toNum(parts[1])
    const close = toNum(parts[2])
    const high = toNum(parts[3])
    const low = toNum(parts[4])
    const amount = toNum(parts[5])
    if (!date || open == null || close == null || high == null || low == null) continue
    out.push({ date, open, high, low, close, amount })
  }
  return out.filter((row) => Number.isFinite(row.close)).sort((a, b) => a.date.localeCompare(b.date))
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
  const highs = alignedBars.map((bar) => bar.high)
  const lows = alignedBars.map((bar) => bar.low)

  const rpsValues = alignedBars.map((bar) => bar.close / (benchmarkMap.get(bar.date) as number))
  const rpsMa50 = buildSma(rpsValues, 50)
  const sma10 = buildSma(closes, 10)
  const sma20 = buildSma(closes, 20)
  const sma250 = buildSma(closes, 250)
  const rsi14 = buildRsi(closes, 14)
  const macd = buildMacd(closes, MACD_SHORT, MACD_LONG, MACD_SIGNAL)
  const atr14 = buildAtr(highs, lows, closes, ATR_PERIOD)

  return alignedBars.map((bar, index) => {
    const ma50 = rpsMa50[index]
    const scorePct = typeof ma50 === 'number' && Number.isFinite(ma50) && ma50 !== 0
      ? (rpsValues[index] / ma50 - 1) * 100
      : null
    return {
      date: bar.date,
      close: bar.close,
      scorePct,
      sma10: sma10[index] ?? null,
      sma20: sma20[index] ?? null,
      sma250: sma250[index] ?? null,
      rsi14: rsi14[index] ?? null,
      macdDiff: macd[index]?.diff ?? null,
      macdDea: macd[index]?.dea ?? null,
      macdHist: macd[index]?.hist ?? null,
      atr14: atr14[index] ?? null,
    }
  })
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

function isBaseEntry(prevBar: PreparedBar, bar: PreparedBar): boolean {
  const prevTone = resolveTone(prevBar.scorePct)
  const tone = resolveTone(bar.scorePct)
  return prevTone === 'negative' && tone === 'neutral'
    && typeof bar.sma250 === 'number' && bar.close >= bar.sma250
}

function isBaseExit(prevBar: PreparedBar, bar: PreparedBar): boolean {
  const prevTone = resolveTone(prevBar.scorePct)
  const tone = resolveTone(bar.scorePct)
  return prevTone === 'neutral' && tone === 'negative'
}

function passesConfirmExit(bar: PreparedBar): boolean {
  const closeBelowSma20 = typeof bar.sma20 === 'number' && bar.close < bar.sma20
  const macdNegative = typeof bar.macdHist === 'number' && bar.macdHist < 0
  const rsiBelow50 = typeof bar.rsi14 === 'number' && bar.rsi14 < 50
  return closeBelowSma20 || macdNegative || rsiBelow50
}

function backtestTicker(profile: TickerProfile, bars: PreparedBar[]): BacktestStats {
  let cash = 1
  let positionUnits = 0
  let entryIndex = -1
  let entryEquity = 0
  let entryType = ''
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

    if (prevBar && positionUnits === 0) {
      let doEntry = false
      let eType = ''

      if (isBaseEntry(prevBar, bar)) {
        doEntry = true
        eType = 'base绿转黄'
      }

      if (doEntry) {
        const buyCash = cash * (1 - FEE_RATE_PER_SIDE)
        positionUnits = buyCash / bar.close
        cash = 0
        entryIndex = i
        entryEquity = buyCash
        entryType = eType
        highestCloseSinceEntry = bar.close
      }
    } else if (prevBar && positionUnits > 0) {
      let exitReason = ''

      const currentEquity = positionUnits * bar.close
      const currentReturn = entryEquity > 0 ? (currentEquity / entryEquity - 1) : 0

      const hitHardStop = currentReturn <= -HARD_STOP_PCT

      const hitAtrStop = typeof bar.atr14 === 'number' && Number.isFinite(bar.atr14) && bar.atr14 > 0 &&
        bar.close <= highestCloseSinceEntry - ATR_MULTIPLIER * bar.atr14

      let hitTrailing = false
      let trailLabel = ''
      if (highestCloseSinceEntry > 0 && !hitHardStop && !hitAtrStop) {
        if (currentReturn >= TRAIL_TIGHT_FLOOR) {
          hitTrailing = bar.close <= highestCloseSinceEntry * (1 - TRAIL_PCT_TIGHT)
          trailLabel = `trail${Math.round(TRAIL_PCT_TIGHT * 100)}%`
        } else if (currentReturn >= TRAIL_MID_FLOOR) {
          hitTrailing = bar.close <= highestCloseSinceEntry * (1 - TRAIL_PCT_MID)
          trailLabel = `trail${Math.round(TRAIL_PCT_MID * 100)}%`
        }
      }

      const hitConfirmExit = isBaseExit(prevBar, bar) && passesConfirmExit(bar)

      if (hitHardStop) {
        exitReason = '硬止损-7%'
      } else if (hitAtrStop) {
        exitReason = `ATR-${ATR_MULTIPLIER}x`
      } else if (hitTrailing) {
        exitReason = trailLabel
      } else if (hitConfirmExit) {
        exitReason = 'confirm(黄转绿)'
      }

      if (!exitReason) {
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
        exitReason,
        entryType,
        holdBars: Math.max(1, i - entryIndex),
        returnPct: entryEquity > 0 ? (net / entryEquity - 1) * 100 : 0,
      })
      entryIndex = -1
      entryEquity = 0
      entryType = ''
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
      exitReason: '持仓至期末',
      entryType,
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
    earlyEntries: 0,
    detailedTrades: trades,
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
    totalEarlyEntries: stats.reduce((sum, item) => sum + item.earlyEntries, 0),
  }
}

async function main() {
  console.log(`\n===== ${STRATEGY_NAME} 策略回测 =====\n`)
  console.log(`回测区间: ${START_DATE} ~ ${END_DATE}`)
  console.log(`基准: ${BENCHMARK}  |  费率: ${FEE_RATE_PER_SIDE * 100}%\n`)
  console.log(`入场: 绿转黄 + close>=SMA250（不变）`)
  console.log(`出场递进:`)
  console.log(`  ① 硬止损-${Math.round(HARD_STOP_PCT*100)}% — 浮亏达${Math.round(HARD_STOP_PCT*100)}%立即退出`)
  console.log(`  ② ATR-${ATR_MULTIPLIER}x(${ATR_PERIOD}) — 防暴跌`)
  console.log(`  ③ 分级追踪 — 浮盈<${Math.round(TRAIL_MID_FLOOR*100)}%无追踪 / ${Math.round(TRAIL_MID_FLOOR*100)}%~${Math.round(TRAIL_TIGHT_FLOOR*100)}%→-${Math.round(TRAIL_PCT_MID*100)}% / ≥${Math.round(TRAIL_TIGHT_FLOOR*100)}%→-${Math.round(TRAIL_PCT_TIGHT*100)}%`)
  console.log(`  ④ confirm — 黄转绿+confirm信号\n`)
  const benchmarkSeries = await fetchBenchmarkSeries()
  console.log(`  H30269: ${benchmarkSeries.length} 条\n`)

  const allStats: BacktestStats[] = []

  for (const profile of SAMPLE_TICKERS) {
    console.log(`正在获取 ${profile.ticker} (${profile.name}) 数据...`)
    const rawBars = await fetchTickerBars(profile)
    const preparedBars = prepareBars(rawBars, benchmarkSeries)
    if (preparedBars.length === 0) {
      console.log(`  ⚠ 无有效数据，跳过`)
      continue
    }
    const stats = backtestTicker(profile, preparedBars)
    allStats.push(stats)

    console.log(`  ✓ 总收益: ${stats.totalReturnPct}% | CAGR: ${stats.cagrPct}% | 最大回撤: ${stats.maxDrawdownPct}%`)
    console.log(`    交易: ${stats.trades} | 胜率: ${stats.winRatePct}% | 持日: ${stats.avgHoldDays} | 持仓: ${stats.exposurePct}%`)
    const reasonCount: Record<string, number> = {}
    for (const t of stats.detailedTrades) {
      reasonCount[t.exitReason] = (reasonCount[t.exitReason] || 0) + 1
    }
    console.log(`    退出原因:`)
    for (const [reason, count] of Object.entries(reasonCount)) {
      console.log(`      ${reason}: ${count}次`)
    }
    console.log('')
  }

  const agg = aggregateStats(allStats)

  console.log('===== 汇总 =====\n')
  console.log(`5只ETF平均总收益: ${agg.avgTotalReturnPct}% (中位数: ${agg.medianTotalReturnPct}%)`)
  console.log(`平均CAGR: ${agg.avgCagrPct}%`)
  console.log(`平均最大回撤: ${agg.avgMaxDrawdownPct}%`)
  console.log(`平均交易: ${agg.avgTrades}`)
  console.log(`平均胜率: ${agg.avgWinRatePct}%`)
  console.log(`平均持日: ${agg.avgHoldDays}`)
  console.log(`平均持仓占比: ${agg.avgExposurePct}%\n`)

  console.log('===== 逐笔交易明细 =====\n')
  for (const stats of allStats) {
    console.log(`--- ${stats.ticker} (${stats.name}) ---`)
    for (const t of stats.detailedTrades) {
      console.log(`  入场: ${t.entryDate} | 出场: ${t.exitDate} | 持日: ${t.holdBars} | 收益: ${roundTo(t.returnPct, 2)}% | 原因: ${t.exitReason}`)
    }
    console.log('')
  }

  const output = {
    strategy: {
      name: STRATEGY_NAME,
      version: '5.1',
      basedOn: 'confirmTrail12',
      design: 'V5.1递进止损：硬止损-7% + ATR-3x + 分级追踪(5%→10%/12%→8%) + confirm',
      entry: {
        base: '绿转黄 + close >= SMA250（不变）',
      },
      exit: {
        hardStop: `浮亏 ≥ ${Math.round(HARD_STOP_PCT * 100)}% 立即退出（替代原版-12%追踪的"太晚"问题）`,
        atrStop: `close ≤ highestClose - ${ATR_MULTIPLIER}×ATR(${ATR_PERIOD})`,
        tieredTrail: `浮盈<${Math.round(TRAIL_MID_FLOOR * 100)}%无追踪 / ${Math.round(TRAIL_MID_FLOOR * 100)}%~${Math.round(TRAIL_TIGHT_FLOOR * 100)}%→-${Math.round(TRAIL_PCT_MID * 100)}% / ≥${Math.round(TRAIL_TIGHT_FLOOR * 100)}%→-${Math.round(TRAIL_PCT_TIGHT * 100)}%`,
        confirm: '黄转绿 + (close<SMA20 或 MACD Hist<0 或 RSI<50)（不变）',
      },
      macdParams: { short: MACD_SHORT, long: MACD_LONG, signal: MACD_SIGNAL },
      atrParams: { period: ATR_PERIOD, multiplier: ATR_MULTIPLIER },
      feeRatePerSide: FEE_RATE_PER_SIDE,
      benchmark: BENCHMARK,
      startDate: START_DATE,
      endDate: END_DATE,
    },
    aggregate: agg,
    byTicker: allStats,
  }

  const outPath = new URL('./momentum_confirmTrail12_enhanced_v4_output.json', import.meta.url)
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`结果已写入: ${outPath.pathname}`)
}

await main()
