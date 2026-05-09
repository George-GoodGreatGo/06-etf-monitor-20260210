import { writeFile } from 'node:fs/promises'

import { fetchEastmoneyDailyKline, fetchEastmoneyDailyKlineWithAmount } from '../server/lib/eastmoneyKline.ts'
import { fetchLowVolIndexCloseSeries } from '../server/lib/lowVol.ts'

type TickerProfile = {
  ticker: string
  name: string
}

type PriceBar = {
  date: string
  close: number
  amount: number | null
}

type PreparedBar = {
  date: string
  close: number
  sma10: number | null
  sma250: number | null
  macdDiff: number | null
  macdDea: number | null
  volMultiple: number | null
  rpsScore: number | null
}

type TradeRecord = {
  entryDate: string
  exitDate: string
  exitReason: string
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
}

const STRATEGY_NAME = 'SMA10_MACD_Cross_V3.2_HS300_RPS_ExitOnly'
const START_DATE = '2016-01-01'
const END_DATE = '2026-05-09'
const FEE_RATE_PER_SIDE = 0.001
const TRAILING_STOP_PCT = 0.12
const HARD_STOP_PCT = 0.05
const TIME_STOP_BARS = 20

const MACD_SHORT = 8
const MACD_LONG = 21
const MACD_SIGNAL = 5

const VOL_LOOKBACK = 20
const VOL_THRESHOLD = 1.3

const BENCHMARK = 'H30269'
const HS300_SECID = '1.000300'

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

function buildTurnoverMultiple(values: Array<number | null>, lookback: number): Array<number | null> {
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

function ymd8(ymd10: string): string {
  return ymd10.replace(/-/g, '')
}

function tickerToSecid(ticker: string): string {
  const [code, exchange] = ticker.split('.')
  return `${exchange === 'SH' ? '1' : '0'}.${code}`
}

function isGoldenCross(curr: PreparedBar, prev: PreparedBar | null): boolean {
  if (!prev) return false
  if (
    typeof curr.macdDiff !== 'number' || !Number.isFinite(curr.macdDiff) ||
    typeof curr.macdDea !== 'number' || !Number.isFinite(curr.macdDea) ||
    typeof prev.macdDiff !== 'number' || !Number.isFinite(prev.macdDiff) ||
    typeof prev.macdDea !== 'number' || !Number.isFinite(prev.macdDea)
  ) return false
  return curr.macdDiff > curr.macdDea && prev.macdDiff <= prev.macdDea
}

function isDeathCross(curr: PreparedBar, prev: PreparedBar | null): boolean {
  if (!prev) return false
  if (
    typeof curr.macdDiff !== 'number' || !Number.isFinite(curr.macdDiff) ||
    typeof curr.macdDea !== 'number' || !Number.isFinite(curr.macdDea) ||
    typeof prev.macdDiff !== 'number' || !Number.isFinite(prev.macdDiff) ||
    typeof prev.macdDea !== 'number' || !Number.isFinite(prev.macdDea)
  ) return false
  return curr.macdDiff < curr.macdDea && prev.macdDiff >= prev.macdDea
}

function crossesAboveSma10(curr: PreparedBar, prev: PreparedBar | null): boolean {
  if (!prev) return false
  if (
    typeof curr.sma10 !== 'number' || !Number.isFinite(curr.sma10) ||
    typeof prev.sma10 !== 'number' || !Number.isFinite(prev.sma10)
  ) return false
  return curr.close > curr.sma10 && prev.close <= prev.sma10
}

function crossesBelowSma10(curr: PreparedBar, prev: PreparedBar | null): boolean {
  if (!prev) return false
  if (
    typeof curr.sma10 !== 'number' || !Number.isFinite(curr.sma10) ||
    typeof prev.sma10 !== 'number' || !Number.isFinite(prev.sma10)
  ) return false
  return curr.close < curr.sma10 && prev.close >= prev.sma10
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

async function fetchHs300Series(): Promise<Map<string, { close: number; sma250: number }>> {
  const bars = await fetchEastmoneyDailyKline({
    secid: HS300_SECID,
    beg: ymd8(START_DATE),
    end: ymd8(END_DATE),
  })
  const sorted = bars
    .filter((b) => Number.isFinite(b.close))
    .sort((a, b) => a.date.localeCompare(b.date))
  const closes = sorted.map((b) => b.close)
  const sma250 = buildSma(closes, 250)
  const map = new Map<string, { close: number; sma250: number }>()
  sorted.forEach((b, i) => {
    if (sma250[i] != null) {
      map.set(b.date, { close: b.close, sma250: sma250[i]! })
    }
  })
  return map
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
  const sma10 = buildSma(closes, 10)
  const sma250 = buildSma(closes, 250)
  const macd = buildMacd(closes, MACD_SHORT, MACD_LONG, MACD_SIGNAL)
  const volMultiple = buildTurnoverMultiple(amounts, VOL_LOOKBACK)

  return alignedBars.map((bar, index) => {
    const ma50 = rpsMa50[index]
    const rpsScore = typeof ma50 === 'number' && Number.isFinite(ma50) && ma50 !== 0
      ? (rpsValues[index] / ma50 - 1) * 100
      : null
    return {
      date: bar.date,
      close: bar.close,
      sma10: sma10[index] ?? null,
      sma250: sma250[index] ?? null,
      macdDiff: macd[index]?.diff ?? null,
      macdDea: macd[index]?.dea ?? null,
      volMultiple: volMultiple[index] ?? null,
      rpsScore,
    }
  })
}

function backtestTicker(
  profile: TickerProfile,
  bars: PreparedBar[],
  hs300Map: Map<string, { close: number; sma250: number }>,
): BacktestStats {
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

    if (prevBar && positionUnits === 0) {
      const aboveSma250 = typeof bar.sma250 === 'number' && Number.isFinite(bar.sma250) && bar.close >= bar.sma250
      if (!aboveSma250) {
        const equity = cash
        equityCurve.push(equity)
        continue
      }

      const hs300 = hs300Map.get(bar.date)
      const hs300AboveSma250 = hs300 != null && hs300.close >= hs300.sma250
      if (!hs300AboveSma250) {
        const equity = cash
        equityCurve.push(equity)
        continue
      }

      const rpsOk = typeof bar.rpsScore === 'number' && Number.isFinite(bar.rpsScore) && bar.rpsScore >= 0

      let enhancedScore = 0
      if (crossesAboveSma10(bar, prevBar)) enhancedScore += 1
      if (isGoldenCross(bar, prevBar)) enhancedScore += 1
      if (typeof bar.volMultiple === 'number' && Number.isFinite(bar.volMultiple) && bar.volMultiple >= VOL_THRESHOLD) enhancedScore += 1

      if (enhancedScore >= 2) {
        const buyCash = cash * (1 - FEE_RATE_PER_SIDE)
        positionUnits = buyCash / bar.close
        cash = 0
        entryIndex = i
        entryEquity = buyCash
        highestCloseSinceEntry = bar.close
      }
    } else if (prevBar && positionUnits > 0) {
      let exitReason = ''

      const belowSma250 = typeof bar.sma250 === 'number' && Number.isFinite(bar.sma250) && bar.close < bar.sma250

      const hitHardStop = entryEquity > 0 &&
        (positionUnits * bar.close) / entryEquity <= (1 - HARD_STOP_PCT)

      const rpsScore = bar.rpsScore
      const rpsNegative = typeof rpsScore === 'number' && Number.isFinite(rpsScore) && rpsScore < 0

      const heldBars = i - entryIndex
      const hitTimeStop = heldBars >= TIME_STOP_BARS &&
        entryEquity > 0 && (positionUnits * bar.close) <= entryEquity

      const hitTrailingStop = highestCloseSinceEntry > 0 && bar.close <= highestCloseSinceEntry * (1 - TRAILING_STOP_PCT)

      const deathAndBelow = crossesBelowSma10(bar, prevBar) && isDeathCross(bar, prevBar)

      if (belowSma250) {
        exitReason = 'close<SMA250'
      } else if (hitHardStop) {
        exitReason = 'hardStop-5%'
      } else if (rpsNegative) {
        exitReason = 'rpsScore<0'
      } else if (hitTimeStop) {
        exitReason = 'timeStop20d'
      } else if (hitTrailingStop) {
        exitReason = 'trailingStop12%'
      } else if (deathAndBelow) {
        exitReason = 'SMA10死叉+MACD死叉'
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
      exitReason: '持仓至期末',
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
  }
}

async function main() {
  console.log(`\n===== ${STRATEGY_NAME} 策略回测 =====\n`)
  console.log(`回测区间: ${START_DATE} ~ ${END_DATE}`)
  console.log(`V3.2: 大盘过滤 + RPS仅用于出场（入场不要求RPS Score）`)
  console.log(`  1.大盘: 沪深300 close≥SMA250 才允许入场`)
  console.log(`  2.入场: ETF≥SMA250 + 3增强至少满足2个(SMA10突破/MACD金叉/放量>1.3x)`)
  console.log(`  3.出场: close<SMA250 / -5%硬止损 / RPS Score<0 / 20日亏 / -12%追踪 / 死叉`)
  console.log(`MACD: (${MACD_SHORT},${MACD_LONG},${MACD_SIGNAL})  |  费率: ${FEE_RATE_PER_SIDE * 100}%\n`)

  console.log('正在获取基准(H30269)和沪深300数据...')
  const [benchmarkSeries, hs300Map] = await Promise.all([
    fetchBenchmarkSeries(),
    fetchHs300Series(),
  ])
  console.log(`  H30269: ${benchmarkSeries.length} 条 | 沪深300 SMA250: ${hs300Map.size} 条\n`)

  const allStats: BacktestStats[] = []

  for (const profile of SAMPLE_TICKERS) {
    console.log(`正在获取 ${profile.ticker} (${profile.name}) 数据...`)
    const rawBars = await fetchTickerBars(profile)
    const preparedBars = prepareBars(rawBars, benchmarkSeries)
    if (preparedBars.length === 0) {
      console.log(`  ⚠ 无有效数据，跳过`)
      continue
    }
    const stats = backtestTicker(profile, preparedBars, hs300Map)
    allStats.push(stats)

    console.log(`  ✓ 总收益: ${stats.totalReturnPct}% | CAGR: ${stats.cagrPct}% | 最大回撤: ${stats.maxDrawdownPct}%`)
    console.log(`    交易次数: ${stats.trades} | 胜率: ${stats.winRatePct}% | 平均持日: ${stats.avgHoldDays} | 持仓占比: ${stats.exposurePct}%`)
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
  console.log(`平均交易次数: ${agg.avgTrades}`)
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
      version: '3.2',
      design: '大盘过滤 + RPS仅用于出场 + SMA10-MACD技术信号（入场不要求RPS Score）',
      marketFilter: '沪深300 close >= SMA250 才允许入场',
      entry: [
        'ETF close >= SMA250',
        '3增强至少满足2个: SMA10突破 / MACD金叉(8,21,5) / 成交量>1.3x20日均',
        '注意: 入场不要求RPS Score >= 0',
      ],
      exit: [
        'close < SMA250',
        '-5% 硬止损',
        'RPS Score < 0（动量转负）',
        '持日>=20 且亏损 → 时间止损',
        '-12% 追踪回撤止损',
        'SMA10死叉 + MACD死叉',
      ],
      macdParams: { short: MACD_SHORT, long: MACD_LONG, signal: MACD_SIGNAL },
      feeRatePerSide: FEE_RATE_PER_SIDE,
      trailingStopPct: TRAILING_STOP_PCT,
      hardStopPct: HARD_STOP_PCT,
      timeStopBars: TIME_STOP_BARS,
      volLookback: VOL_LOOKBACK,
      volThreshold: VOL_THRESHOLD,
      benchmark: BENCHMARK,
      marketIndex: '000300.SH',
      startDate: START_DATE,
      endDate: END_DATE,
    },
    aggregate: agg,
    byTicker: allStats,
  }

  const outPath = new URL('./momentum_sma10_macd_backtest_v3_output.json', import.meta.url)
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`结果已写入: ${outPath.pathname}`)
}

await main()
