import { writeFile } from 'node:fs/promises'

import { fetchLowVolIndexCloseSeries } from '../server/lib/lowVol.ts'

type TickerProfile = { ticker: string; name: string }
type Tone = 'negative' | 'neutral' | 'positive' | 'strong'

type PriceBar = {
  date: string; open: number; high: number; low: number; close: number; amount: number | null
}

type PreparedBar = {
  date: string; close: number
  scorePct: number | null
  sma20: number | null; sma250: number | null
  rsi14: number | null
  macdHist: number | null; macdDiff: number | null; macdDea: number | null
  atr14: number | null
}

type TradeRecord = {
  entryDate: string; exitDate: string; exitReason: string
  holdBars: number; returnPct: number
}

type BacktestStats = {
  ticker: string; name: string; bars: number
  startDate: string; endDate: string
  totalReturnPct: number; cagrPct: number; maxDrawdownPct: number
  trades: number; winRatePct: number; avgHoldDays: number; exposurePct: number
  detailedTrades: TradeRecord[]
}

const START_DATE = '2016-01-01'
const END_DATE = '2026-05-09'
const BENCHMARK = 'H30269'
const FEE_RATE_PER_SIDE = 0.001
const MACD_SHORT = 8; const MACD_LONG = 21; const MACD_SIGNAL = 5
const ATR_PERIOD = 14; const ATR_MULTIPLIER = 3.0
const HARD_STOP_PCT = 0.07
const TRAIL_PCT_MID = 0.10; const TRAIL_PCT_TIGHT = 0.08
const TRAIL_MID_FLOOR = 0.05; const TRAIL_TIGHT_FLOOR = 0.12
const TRAILING_STOP_PCT_WIDE = 0.12

const SAMPLE_TICKERS: TickerProfile[] = [
  { ticker: '159915.SZ', name: '创业板ETF' },
  { ticker: '588000.SH', name: '科创50ETF' },
  { ticker: '159781.SZ', name: '科创创业ETF' },
  { ticker: '512480.SH', name: '半导体ETF' },
  { ticker: '159869.SZ', name: '游戏ETF' },
]

function roundTo(v: number, d: number): number {
  if (!Number.isFinite(v)) return v
  return Math.round(v * 10 ** d) / 10 ** d
}

function buildSma(vals: number[], p: number): Array<number | null> {
  const o: Array<number | null> = Array(vals.length).fill(null)
  let s = 0
  for (let i = 0; i < vals.length; i++) { s += vals[i]; if (i >= p) s -= vals[i - p]; if (i >= p - 1) o[i] = s / p }
  return o
}

function buildEma(vals: number[], p: number): Array<number | null> {
  const o: Array<number | null> = Array(vals.length).fill(null)
  const m = 2 / (p + 1); let e: number | null = null
  for (let i = 0; i < vals.length; i++) { e = e == null ? vals[i] : (vals[i] - e) * m + e; o[i] = e }
  return o
}

function buildMacd(vals: number[], sp: number, lp: number, sig: number) {
  const se = buildEma(vals, sp); const le = buildEma(vals, lp)
  const out: Array<{ diff: number | null; dea: number | null; hist: number | null }> = vals.map(() => ({ diff: null, dea: null, hist: null }))
  const diffs = vals.map((_, i) => (typeof se[i] === 'number' && typeof le[i] === 'number') ? se[i]! - le[i]! : null)
  const m = 2 / (sig + 1); let dea: number | null = null
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i] == null) continue
    dea = dea == null ? diffs[i]! : (diffs[i]! - dea) * m + dea; out[i] = { diff: diffs[i], dea, hist: diffs[i]! - dea }
  }
  return out
}

function buildAtr(hi: number[], lo: number[], cl: number[], p: number): Array<number | null> {
  const o: Array<number | null> = Array(cl.length).fill(null)
  if (cl.length <= 1) return o
  const tr = cl.map((_, i) => i === 0 ? hi[i] - lo[i] : Math.max(hi[i] - lo[i], Math.abs(hi[i] - cl[i - 1]), Math.abs(lo[i] - cl[i - 1])))
  let s = 0
  for (let i = 0; i < tr.length; i++) { s += tr[i]; if (i >= p) s -= tr[i - p]; if (i >= p - 1) o[i] = s / p }
  return o
}

function buildRsi(vals: number[], p: number): Array<number | null> {
  const o: Array<number | null> = Array(vals.length).fill(null)
  if (vals.length <= p) return o
  let g = 0, l = 0
  for (let i = 1; i <= p; i++) { const ch = vals[i] - vals[i - 1]; if (ch >= 0) g += ch; else l -= ch }
  let ag = g / p, al = l / p
  o[p] = al === 0 && ag === 0 ? 50 : al === 0 ? 100 : ag === 0 ? 0 : 100 - 100 / (1 + ag / al)
  for (let i = p + 1; i < vals.length; i++) {
    const ch = vals[i] - vals[i - 1]; const gi = ch > 0 ? ch : 0; const li = ch < 0 ? -ch : 0
    ag = (ag * (p - 1) + gi) / p; al = (al * (p - 1) + li) / p
    o[i] = al === 0 ? 100 : ag === 0 ? 0 : 100 - 100 / (1 + ag / al)
  }
  return o
}

function ymd8(ymd10: string) { return ymd10.replace(/-/g, '') }
function tickerSecid(t: string) { const [c, e] = t.split('.'); return `${e === 'SH' ? '1' : '0'}.${c}` }
function resolveTone(s: number | null | undefined): Tone {
  if (typeof s !== 'number' || !Number.isFinite(s)) return 'neutral'
  if (s < 0) return 'negative'; if (s <= 10) return 'neutral'; if (s <= 20) return 'positive'; return 'strong'
}
function calcMaxDd(curve: number[]): number {
  let pk = -Infinity, md = 0
  for (const e of curve) { if (!Number.isFinite(e)) continue; if (e > pk) pk = e; if (pk > 0) { const dd = (pk - e) / pk; if (dd > md) md = dd } }
  return md * 100
}

function toNum(v: unknown): number | null { const n = typeof v === 'number' ? v : v == null ? NaN : Number(v); return Number.isFinite(n) ? n : null }

async function fetchTickerBars(p: TickerProfile): Promise<PriceBar[]> {
  const sid = tickerSecid(p.ticker); const bg = ymd8(START_DATE); const en = ymd8(END_DATE)
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  url.searchParams.set('secid', sid); url.searchParams.set('klt', '101'); url.searchParams.set('fqt', '1')
  url.searchParams.set('beg', bg); url.searchParams.set('end', en)
  url.searchParams.set('fields1', 'f1,f2'); url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f57')
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b')
  const r = await fetch(url.toString()); if (!r.ok) throw new Error(`eastmoney fail ${r.status}`)
  const j = (await r.json().catch(() => null)) as { data?: { klines?: string[] } } | null
  const kls = Array.isArray(j?.data?.klines) ? j.data.klines : []
  const out: PriceBar[] = []
  for (const row of kls) {
    if (typeof row !== 'string') continue; const parts = row.split(','); if (parts.length < 6) continue
    const dt = parts[0].trim(); const o = toNum(parts[1]); const c = toNum(parts[2]); const h = toNum(parts[3]); const l = toNum(parts[4]); const a = toNum(parts[5])
    if (!dt || o == null || c == null || h == null || l == null) continue
    out.push({ date: dt, open: o, high: h, low: l, close: c, amount: a })
  }
  return out.filter(r => Number.isFinite(r.close)).sort((a, b) => a.date.localeCompare(b.date))
}

function prepareBars(priceBars: PriceBar[], bench: Array<{ date: string; close: number }>): PreparedBar[] {
  const bm = new Map(bench.map(r => [r.date, r.close]))
  const ab = priceBars.filter(b => { const bc = bm.get(b.date); return typeof bc === 'number' && Number.isFinite(bc) && bc > 0 })
  const cl = ab.map(b => b.close); const hi = ab.map(b => b.high); const lo = ab.map(b => b.low)
  const rv = ab.map(b => b.close / (bm.get(b.date) as number))
  const ma50 = buildSma(rv, 50); const sma20 = buildSma(cl, 20); const sma250 = buildSma(cl, 250)
  const rsi14 = buildRsi(cl, 14); const macd = buildMacd(cl, MACD_SHORT, MACD_LONG, MACD_SIGNAL)
  const atr14 = buildAtr(hi, lo, cl, ATR_PERIOD)
  return ab.map((b, i) => {
    const m50 = ma50[i]; const sc = typeof m50 === 'number' && Number.isFinite(m50) && m50 !== 0 ? (rv[i] / m50 - 1) * 100 : null
    return { date: b.date, close: b.close, scorePct: sc, sma20: sma20[i] ?? null, sma250: sma250[i] ?? null, rsi14: rsi14[i] ?? null, macdDiff: macd[i]?.diff ?? null, macdDea: macd[i]?.dea ?? null, macdHist: macd[i]?.hist ?? null, atr14: atr14[i] ?? null }
  })
}

function isBaseEntry(prev: PreparedBar, bar: PreparedBar): boolean {
  return resolveTone(prev.scorePct) === 'negative' && resolveTone(bar.scorePct) === 'neutral' && typeof bar.sma250 === 'number' && bar.close >= bar.sma250
}
function isBaseExit(prev: PreparedBar, bar: PreparedBar): boolean {
  return resolveTone(prev.scorePct) === 'neutral' && resolveTone(bar.scorePct) === 'negative'
}
function passesConfirm(bar: PreparedBar): boolean {
  return (typeof bar.sma20 === 'number' && bar.close < bar.sma20) || (typeof bar.macdHist === 'number' && bar.macdHist < 0) || (typeof bar.rsi14 === 'number' && bar.rsi14 < 50)
}

function backtestConfirmTrail12(bars: PreparedBar[], profile: TickerProfile): BacktestStats {
  let cash = 1, units = 0, ei = -1, ee = 0, hiClose = 0, expo = 0
  const trades: TradeRecord[] = []; const curve: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]; const prev = i > 0 ? bars[i - 1] : null
    if (units > 0) { expo++; if (bar.close > hiClose) hiClose = bar.close }
    if (prev && units === 0 && isBaseEntry(prev, bar)) {
      const bc = cash * (1 - FEE_RATE_PER_SIDE); units = bc / bar.close; cash = 0; ei = i; ee = bc; hiClose = bar.close
    } else if (prev && units > 0) {
      let exit = ''
      const below250 = typeof bar.sma250 === 'number' && bar.close < bar.sma250
      const hitTrail = hiClose > 0 && bar.close <= hiClose * (1 - TRAILING_STOP_PCT_WIDE)
      const confirmExit = isBaseExit(prev, bar) && passesConfirm(bar)
      if (below250) exit = 'close<SMA250'
      else if (hitTrail) exit = 'trailing12%'
      else if (confirmExit) exit = 'confirm(黄转绿)'
      if (!exit) { curve.push(units * bar.close); continue }
      const gross = units * bar.close; cash = gross * (1 - FEE_RATE_PER_SIDE); units = 0
      trades.push({ entryDate: bars[ei].date, exitDate: bar.date, exitReason: exit, holdBars: Math.max(1, i - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
      ei = -1; ee = 0; hiClose = 0
    }
    curve.push(units > 0 ? units * bar.close : cash)
  }
  if (units > 0) {
    const lb = bars[bars.length - 1]; cash = units * lb.close * (1 - FEE_RATE_PER_SIDE)
    trades.push({ entryDate: bars[ei].date, exitDate: lb.date, exitReason: '持仓至期末', holdBars: Math.max(1, bars.length - 1 - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
    curve[curve.length - 1] = cash
  }
  return buildStats(profile, bars, trades, curve, expo)
}

function backtestV6(bars: PreparedBar[], profile: TickerProfile): BacktestStats {
  let cash = 1, units = 0, ei = -1, ee = 0, hiClose = 0, expo = 0
  const trades: TradeRecord[] = []; const curve: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]; const prev = i > 0 ? bars[i - 1] : null
    if (units > 0) { expo++; if (bar.close > hiClose) hiClose = bar.close }
    if (prev && units === 0 && isBaseEntry(prev, bar)) {
      const bc = cash * (1 - FEE_RATE_PER_SIDE); units = bc / bar.close; cash = 0; ei = i; ee = bc; hiClose = bar.close
    } else if (prev && units > 0) {
      let exit = ''
      const below250 = typeof bar.sma250 === 'number' && bar.close < bar.sma250
      const hitHard = ee > 0 && (units * bar.close) / ee <= (1 - HARD_STOP_PCT)
      const hitAtr = typeof bar.atr14 === 'number' && bar.atr14 > 0 && bar.close <= hiClose - ATR_MULTIPLIER * bar.atr14
      const hitTrail = hiClose > 0 && bar.close <= hiClose * (1 - TRAILING_STOP_PCT_WIDE)
      const confirmExit = isBaseExit(prev, bar) && passesConfirm(bar)
      if (below250) exit = 'close<SMA250'
      else if (hitHard) exit = '硬止损-7%'
      else if (hitAtr) exit = 'ATR-3x'
      else if (hitTrail) exit = 'trailing12%'
      else if (confirmExit) exit = 'confirm(黄转绿)'
      if (!exit) { curve.push(units * bar.close); continue }
      const gross = units * bar.close; cash = gross * (1 - FEE_RATE_PER_SIDE); units = 0
      trades.push({ entryDate: bars[ei].date, exitDate: bar.date, exitReason: exit, holdBars: Math.max(1, i - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
      ei = -1; ee = 0; hiClose = 0
    }
    curve.push(units > 0 ? units * bar.close : cash)
  }
  if (units > 0) {
    const lb = bars[bars.length - 1]; cash = units * lb.close * (1 - FEE_RATE_PER_SIDE)
    trades.push({ entryDate: bars[ei].date, exitDate: lb.date, exitReason: '持仓至期末', holdBars: Math.max(1, bars.length - 1 - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
    curve[curve.length - 1] = cash
  }
  return buildStats(profile, bars, trades, curve, expo)
}

function backtestV61(bars: PreparedBar[], profile: TickerProfile): BacktestStats {
  let cash = 1, units = 0, ei = -1, ee = 0, hiClose = 0, expo = 0
  let blockUntilIndex = -1
  const trades: TradeRecord[] = []; const curve: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]; const prev = i > 0 ? bars[i - 1] : null
    if (units > 0) { expo++; if (bar.close > hiClose) hiClose = bar.close }
    if (prev && units === 0 && isBaseEntry(prev, bar)) {
      if (i <= blockUntilIndex) {
        continue
      } else {
        const bc = cash * (1 - FEE_RATE_PER_SIDE); units = bc / bar.close; cash = 0; ei = i; ee = bc; hiClose = bar.close
      }
    } else if (prev && units > 0) {
      let exit = ''
      const below250 = typeof bar.sma250 === 'number' && bar.close < bar.sma250
      const hitHard = ee > 0 && (units * bar.close) / ee <= (1 - HARD_STOP_PCT)
      const hitAtr = typeof bar.atr14 === 'number' && bar.atr14 > 0 && bar.close <= hiClose - ATR_MULTIPLIER * bar.atr14
      const hitTrail = hiClose > 0 && bar.close <= hiClose * (1 - TRAILING_STOP_PCT_WIDE)
      const confirmExit = isBaseExit(prev, bar) && passesConfirm(bar)
      if (below250) exit = 'close<SMA250'
      else if (hitHard) exit = '硬止损-7%'
      else if (hitAtr) exit = 'ATR-3x'
      else if (hitTrail) exit = 'trailing12%'
      else if (confirmExit) exit = 'confirm(黄转绿)'
      if (!exit) { curve.push(units * bar.close); continue }
      const gross = units * bar.close; cash = gross * (1 - FEE_RATE_PER_SIDE); units = 0
      trades.push({ entryDate: bars[ei].date, exitDate: bar.date, exitReason: exit, holdBars: Math.max(1, i - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
      if (exit === 'ATR-3x' || exit === '硬止损-7%') blockUntilIndex = i + 10
      ei = -1; ee = 0; hiClose = 0
    }
    curve.push(units > 0 ? units * bar.close : cash)
  }
  if (units > 0) {
    const lb = bars[bars.length - 1]; cash = units * lb.close * (1 - FEE_RATE_PER_SIDE)
    trades.push({ entryDate: bars[ei].date, exitDate: lb.date, exitReason: '持仓至期末', holdBars: Math.max(1, bars.length - 1 - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
    curve[curve.length - 1] = cash
  }
  return buildStats(profile, bars, trades, curve, expo)
}

function backtestV51(bars: PreparedBar[], profile: TickerProfile): BacktestStats {
  let cash = 1, units = 0, ei = -1, ee = 0, hiClose = 0, expo = 0
  const trades: TradeRecord[] = []; const curve: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]; const prev = i > 0 ? bars[i - 1] : null
    if (units > 0) { expo++; if (bar.close > hiClose) hiClose = bar.close }
    if (prev && units === 0 && isBaseEntry(prev, bar)) {
      const bc = cash * (1 - FEE_RATE_PER_SIDE); units = bc / bar.close; cash = 0; ei = i; ee = bc; hiClose = bar.close
    } else if (prev && units > 0) {
      let exit = ''
      const curRet = ee > 0 ? (units * bar.close) / ee - 1 : 0
      const hitHard = curRet <= -HARD_STOP_PCT
      const hitAtr = typeof bar.atr14 === 'number' && bar.atr14 > 0 && bar.close <= hiClose - ATR_MULTIPLIER * bar.atr14
      let hitTrail = false; let trailLabel = ''
      if (!hitHard && !hitAtr && hiClose > 0) {
        if (curRet >= TRAIL_TIGHT_FLOOR) { hitTrail = bar.close <= hiClose * (1 - TRAIL_PCT_TIGHT); trailLabel = 'trail8%' }
        else if (curRet >= TRAIL_MID_FLOOR) { hitTrail = bar.close <= hiClose * (1 - TRAIL_PCT_MID); trailLabel = 'trail10%' }
      }
      const confirmExit = isBaseExit(prev, bar) && passesConfirm(bar)
      if (hitHard) exit = '硬止损-7%'
      else if (hitAtr) exit = 'ATR-3x'
      else if (hitTrail) exit = trailLabel
      else if (confirmExit) exit = 'confirm(黄转绿)'
      if (!exit) { curve.push(units * bar.close); continue }
      const gross = units * bar.close; cash = gross * (1 - FEE_RATE_PER_SIDE); units = 0
      trades.push({ entryDate: bars[ei].date, exitDate: bar.date, exitReason: exit, holdBars: Math.max(1, i - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
      ei = -1; ee = 0; hiClose = 0
    }
    curve.push(units > 0 ? units * bar.close : cash)
  }
  if (units > 0) {
    const lb = bars[bars.length - 1]; cash = units * lb.close * (1 - FEE_RATE_PER_SIDE)
    trades.push({ entryDate: bars[ei].date, exitDate: lb.date, exitReason: '持仓至期末', holdBars: Math.max(1, bars.length - 1 - ei), returnPct: ee > 0 ? (cash / ee - 1) * 100 : 0 })
    curve[curve.length - 1] = cash
  }
  return buildStats(profile, bars, trades, curve, expo)
}

function buildStats(profile: TickerProfile, bars: PreparedBar[], trades: TradeRecord[], curve: number[], expo: number): BacktestStats {
  const cash = curve[curve.length - 1] || 1
  const totalRet = (cash - 1) * 100
  const yrs = Math.max(1 / 252, bars.length / 252)
  const cagr = (Math.pow(Math.max(cash, 0), 1 / yrs) - 1) * 100
  const wins = trades.filter(t => t.returnPct > 0).length
  return {
    ticker: profile.ticker, name: profile.name, bars: bars.length,
    startDate: bars[0]?.date ?? START_DATE, endDate: bars[bars.length - 1]?.date ?? END_DATE,
    totalReturnPct: roundTo(totalRet, 2), cagrPct: roundTo(cagr, 2),
    maxDrawdownPct: roundTo(calcMaxDd(curve), 2),
    trades: trades.length, winRatePct: roundTo(trades.length ? (wins / trades.length) * 100 : 0, 2),
    avgHoldDays: roundTo(trades.length ? trades.reduce((s, t) => s + t.holdBars, 0) / trades.length : 0, 2),
    exposurePct: roundTo(bars.length ? (expo / bars.length) * 100 : 0, 2),
    detailedTrades: trades,
  }
}

async function main() {
  console.log(`\n===== confirmTrail12 vs V6 vs V6.1 三方对比 =====`)
  console.log(`区间: ${START_DATE} ~ ${END_DATE}  |  基准: ${BENCHMARK}  |  费率: ${FEE_RATE_PER_SIDE * 100}%`)
  console.log(`V6  = ct12 + 硬止损-7% + ATR-3x（追踪-12%不变）`)
  console.log(`V6.1 = V6 + ATR/硬止损后10日冷却（防whipsaw）\n`)

  const bench = await fetchLowVolIndexCloseSeries({ code: BENCHMARK, kind: 'pri', startDate8: ymd8(START_DATE), endDate8: ymd8(END_DATE) })
  console.log(`H30269: ${bench.length} 条\n`)

  const ct12All: BacktestStats[] = []; const v6All: BacktestStats[] = []; const v61All: BacktestStats[] = []

  for (const p of SAMPLE_TICKERS) {
    console.log(`--- ${p.ticker} (${p.name}) ---`)
    const raw = await fetchTickerBars(p)
    const bars = prepareBars(raw, bench)
    if (bars.length === 0) { console.log('  ⚠ 无数据\n'); continue }

    const ct12 = backtestConfirmTrail12(bars, p); ct12All.push(ct12)
    const v6 = backtestV6(bars, p); v6All.push(v6)
    const v61 = backtestV61(bars, p); v61All.push(v61)

    console.log(`  confirmTrail12: 收益 ${ct12.totalReturnPct}%  CAGR ${ct12.cagrPct}%  回撤 ${ct12.maxDrawdownPct}%  交易 ${ct12.trades}  胜率 ${ct12.winRatePct}%`)
    console.log(`  V6:             收益 ${v6.totalReturnPct}%  CAGR ${v6.cagrPct}%  回撤 ${v6.maxDrawdownPct}%  交易 ${v6.trades}  胜率 ${v6.winRatePct}%`)
    console.log(`  V6.1:           收益 ${v61.totalReturnPct}%  CAGR ${v61.cagrPct}%  回撤 ${v61.maxDrawdownPct}%  交易 ${v61.trades}  胜率 ${v61.winRatePct}%`)
    console.log(`  V6.1-ct12: ${roundTo(v61.totalReturnPct - ct12.totalReturnPct, 2)}% | V6.1-V6: ${roundTo(v61.totalReturnPct - v6.totalReturnPct, 2)}%\n`)
  }

  function avg(arr: BacktestStats[]) {
    return {
      ret: roundTo(arr.reduce((s, a) => s + a.totalReturnPct, 0) / arr.length, 2),
      cagr: roundTo(arr.reduce((s, a) => s + a.cagrPct, 0) / arr.length, 2),
      dd: roundTo(arr.reduce((s, a) => s + a.maxDrawdownPct, 0) / arr.length, 2),
    }
  }
  const aCT12 = avg(ct12All); const aV6 = avg(v6All); const aV61 = avg(v61All)

  console.log('===== 三方汇总 =====\n')
  console.log(`                    confirmTrail12   V6              V6.1`)
  console.log(`  平均总收益        ${String(aCT12.ret).padStart(6)}%          ${String(aV6.ret).padStart(6)}%          ${String(aV61.ret).padStart(6)}%`)
  console.log(`  平均CAGR          ${String(aCT12.cagr).padStart(6)}%            ${String(aV6.cagr).padStart(6)}%            ${String(aV61.cagr).padStart(6)}%`)
  console.log(`  平均最大回撤      ${String(aCT12.dd).padStart(6)}%            ${String(aV6.dd).padStart(6)}%            ${String(aV61.dd).padStart(6)}%`)
  console.log(`\n  V6.1 vs ct12: 收益 ${roundTo(aV61.ret - aCT12.ret, 2)}%  CAGR ${roundTo(aV61.cagr - aCT12.cagr, 2)}pp  回撤 ${roundTo(aV61.dd - aCT12.dd, 2)}pp`)
  console.log(`  V6.1 vs V6:   收益 ${roundTo(aV61.ret - aV6.ret, 2)}%  CAGR ${roundTo(aV61.cagr - aV6.cagr, 2)}pp  回撤 ${roundTo(aV61.dd - aV6.dd, 2)}pp`)

  console.log('\n===== 退出原因分布 =====\n')
  for (let i = 0; i < ct12All.length; i++) {
    const ct12 = ct12All[i]; const v6 = v6All[i]; const v61 = v61All[i]
    console.log(`--- ${ct12.ticker} ---`)
    const mk = (t: TradeRecord[]) => Object.entries(t.reduce((m, x) => { m[x.exitReason] = (m[x.exitReason] || 0) + 1; return m }, {} as Record<string, number>)).map(([k, v]) => `${k}:${v}`).join(' ')
    console.log('  ct12:', mk(ct12.detailedTrades))
    console.log('  V6:  ', mk(v6.detailedTrades))
    console.log('  V6.1:', mk(v61.detailedTrades))
    console.log()
  }

  console.log('===== V6.1 vs ct12 差异交易 =====\n')
  for (let i = 0; i < ct12All.length; i++) {
    const ct12 = ct12All[i]; const v61 = v61All[i]
    const ctMap = new Map(ct12.detailedTrades.map(t => [t.entryDate, t]))
    const reported = new Set<string>()
    console.log(`--- ${ct12.ticker} (${ct12.name}) ---`)
    for (const v of v61.detailedTrades) {
      const c = ctMap.get(v.entryDate)
      reported.add(v.entryDate)
      if (!c) {
        console.log(`  🆕 V6.1独有: ${v.entryDate}→${v.exitDate} | ${v.holdBars}d | ${roundTo(v.returnPct, 2)}% | ${v.exitReason}`)
      } else if (c.exitDate !== v.exitDate || c.exitReason !== v.exitReason) {
        console.log(`  🔄 ${v.entryDate} | ct12:${c.exitDate}/${c.exitReason}/${roundTo(c.returnPct, 2)}% → v6.1:${v.exitDate}/${v.exitReason}/${roundTo(v.returnPct, 2)}%`)
      }
    }
    for (const c of ct12.detailedTrades) {
      if (!reported.has(c.entryDate)) console.log(`  ❌ 跳过: ${c.entryDate}→${c.exitDate} | ${c.holdBars}d | ${roundTo(c.returnPct, 2)}% | ${c.exitReason}`)
    }
    console.log()
  }

  const out = {
    meta: { startDate: START_DATE, endDate: END_DATE, benchmark: BENCHMARK, feeRatePerSide: FEE_RATE_PER_SIDE },
    confirmTrail12: { aggregate: aCT12, byTicker: ct12All },
    v6: { aggregate: aV6, byTicker: v6All },
    v61: { aggregate: aV61, byTicker: v61All },
  }
  const outPath = new URL('./momentum_ct12_v6_v61_3way.json', import.meta.url)
  await writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(`结果已写入: ${outPath.pathname}`)
}

await main()
