import type { EquityBondPoint } from './equityBondValue.js'
import type { LiquidityV5Point } from './liquidityV5.js'

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : v == null ? NaN : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function pctChangeByDays(values: number[], days: number): number | null {
  if (days <= 0) return null
  if (values.length <= days) return null
  const last = values[values.length - 1]
  const prev = values[values.length - 1 - days]
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null
  return ((last / prev) - 1) * 100
}

function emaLast(values: number[], period: number): number | null {
  if (!values.length) return null
  const a = 2 / (period + 1)
  let prev: number | null = null
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    prev = prev == null ? v : a * v + (1 - a) * prev
  }
  return prev
}

function buildBollMetrics(values: number[], period = 120, k = 2.0): Array<{ mb: number | null; ub: number | null; lb: number | null; bw: number | null }> {
  const out: Array<{ mb: number | null; ub: number | null; lb: number | null; bw: number | null }> = new Array(values.length)
  const buf = new Array<number>(period)
  let idx = 0
  let count = 0
  let sum = 0
  let sumSq = 0

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (!Number.isFinite(v)) {
      out[i] = { mb: null, ub: null, lb: null, bw: null }
      idx = 0
      count = 0
      sum = 0
      sumSq = 0
      continue
    }

    if (count < period) {
      buf[count] = v
      count += 1
      sum += v
      sumSq += v * v
    } else {
      const old = buf[idx]
      sum -= old
      sumSq -= old * old
      buf[idx] = v
      sum += v
      sumSq += v * v
      idx = (idx + 1) % period
    }

    if (count < period) {
      out[i] = { mb: null, ub: null, lb: null, bw: null }
      continue
    }

    const mb = sum / period
    const numerator = sumSq - (sum * sum) / period
    const variance = numerator <= 0 ? 0 : numerator / (period - 1)
    const std = Math.sqrt(variance)
    const ub = mb + k * std
    const lb = mb - k * std
    const bw = mb === 0 ? null : (ub - lb) / mb
    out[i] = { mb, ub, lb, bw }
  }

  return out
}

function v5Zone(v5: number | null | undefined): 'opportunity' | 'neutral' | 'risk' | 'unknown' {
  if (!isNum(v5)) return 'unknown'
  if (v5 < 30) return 'opportunity'
  if (v5 > 70) return 'risk'
  return 'neutral'
}

function zoneShare(points: LiquidityV5Point[], days: number): { n: number; oppPct: number | null; riskPct: number | null } {
  const end = points.length - 1
  const start = Math.max(0, end - days + 1)
  let n = 0
  let opp = 0
  let risk = 0
  for (let i = start; i <= end; i += 1) {
    const v5 = points[i]?.v5
    if (!isNum(v5)) continue
    n += 1
    if (v5 < 30) opp += 1
    if (v5 > 70) risk += 1
  }
  return {
    n,
    oppPct: n ? (opp / n) * 100 : null,
    riskPct: n ? (risk / n) * 100 : null,
  }
}

export function buildMarketBoardInsightContext(input: {
  series: LiquidityV5Point[]
  equityBond: EquityBondPoint[]
  windowDays?: number
}) {
  const series = input.series || []
  const equityBond = input.equityBond || []
  const windowDays = clampInt(input.windowDays, 30, 720, 720)
  const recentDays = 7

  const last = series.length ? series[series.length - 1] : null
  const dataDate = last?.date ?? null

  const closes = series.map((p) => p.close).filter((v): v is number => isNum(v))
  const horizons = [5, 20, 60, 120, 252] as const

  const returnsPct: Record<string, number | null> = {}
  for (const h of horizons) returnsPct[`d${h}`] = pctChangeByDays(closes, h)

  const ema20 = emaLast(closes, 20)
  const ema60 = emaLast(closes, 60)

  const bollArr = buildBollMetrics(closes, 120, 2.0)
  const lastBoll = bollArr.length ? bollArr[bollArr.length - 1] : { mb: null, ub: null, lb: null, bw: null }
  const bwNow = lastBoll.bw
  const bwPrev20 = bollArr.length > 20 ? bollArr[bollArr.length - 1 - 20]?.bw ?? null : null
  const bwChange20 = isNum(bwNow) && isNum(bwPrev20) && bwPrev20 !== 0 ? (bwNow / bwPrev20 - 1) * 100 : null

  const ebByDate = new Map<string, EquityBondPoint>()
  for (const p of equityBond) {
    if (p && typeof p.date === 'string') ebByDate.set(p.date, p)
  }
  const ebLast = dataDate ? ebByDate.get(dataDate) ?? null : equityBond.length ? equityBond[equityBond.length - 1] : null

  const ebPctValues = equityBond.map((p) => (isNum(p?.pct) ? (p.pct as number) : NaN)).filter((v) => Number.isFinite(v))
  const ebValValues = equityBond.map((p) => (isNum(p?.value) ? (p.value as number) : NaN)).filter((v) => Number.isFinite(v))

  const ebPctChange: Record<string, number | null> = {}
  const ebValChange: Record<string, number | null> = {}
  for (const h of [60, 120, 252] as const) {
    const pctDelta = ebPctValues.length > h ? ebPctValues[ebPctValues.length - 1] - ebPctValues[ebPctValues.length - 1 - h] : null
    const valDelta = ebValValues.length > h ? ebValValues[ebValValues.length - 1] - ebValValues[ebValValues.length - 1 - h] : null
    ebPctChange[`d${h}`] = pctDelta != null && Number.isFinite(pctDelta) ? pctDelta : null
    ebValChange[`d${h}`] = valDelta != null && Number.isFinite(valDelta) ? valDelta : null
  }

  const recentSlice = series.slice(Math.max(0, series.length - recentDays))
  const recentCloses = recentSlice.map((p) => p.close).filter((v): v is number => isNum(v))
  const recentClosePct = recentCloses.length >= 2 ? ((recentCloses[recentCloses.length - 1] / recentCloses[0]) - 1) * 100 : null
  const recentV5 = recentSlice.map((p) => (isNum(p.v5) ? p.v5 : NaN)).filter((v) => Number.isFinite(v))
  const recentV5Delta = recentV5.length >= 2 ? recentV5[recentV5.length - 1] - recentV5[0] : null

  const ebRecent: EquityBondPoint[] = []
  for (const p of recentSlice) {
    const eb = p.date ? ebByDate.get(p.date) : null
    if (eb) ebRecent.push(eb)
  }
  const ebRecentPct = ebRecent.map((p) => (isNum(p.pct) ? p.pct : NaN)).filter((v) => Number.isFinite(v))
  const ebRecentPctDelta = ebRecentPct.length >= 2 ? ebRecentPct[ebRecentPct.length - 1] - ebRecentPct[0] : null

  const share60 = zoneShare(series, 60)
  const share120 = zoneShare(series, 120)

  const windowSlice = series.slice(Math.max(0, series.length - windowDays))
  const windowCloses = windowSlice.map((p) => p.close).filter((v): v is number => isNum(v))
  const windowReturnPct = windowCloses.length >= 2 ? ((windowCloses[windowCloses.length - 1] / windowCloses[0]) - 1) * 100 : null

  const ebWindow: EquityBondPoint[] = []
  for (const p of windowSlice) {
    const eb = p.date ? ebByDate.get(p.date) : null
    if (eb) ebWindow.push(eb)
  }
  const ebWindowPct = ebWindow.map((p) => (isNum(p.pct) ? p.pct : NaN)).filter((v) => Number.isFinite(v))
  const ebWindowPctNow = ebWindowPct.length ? ebWindowPct[ebWindowPct.length - 1] : null
  const ebWindowPctMin = ebWindowPct.length ? Math.min(...ebWindowPct) : null
  const ebWindowPctMax = ebWindowPct.length ? Math.max(...ebWindowPct) : null

  const context = {
    meta: {
      generatedAt: new Date().toISOString(),
      dataDate,
      windowDays,
      recentDays,
      horizonsTradingDays: horizons,
    },
    latest: {
      date: dataDate,
      hs300Close: last?.close ?? null,
      ema20,
      ema60,
      priceVsEma20: isNum(last?.close) && isNum(ema20) ? last.close - ema20 : null,
      priceVsEma60: isNum(last?.close) && isNum(ema60) ? last.close - ema60 : null,
      boll120: {
        mb: lastBoll.mb,
        ub: lastBoll.ub,
        lb: lastBoll.lb,
        bw: lastBoll.bw,
        bwChangePct20d: bwChange20,
      },
      liquidity: {
        amount: last?.amount ?? null,
        amountPct: last?.amountPct ?? null,
        tr: last?.tr ?? null,
        trPct: last?.trPct ?? null,
        northMoney: last?.northMoney ?? null,
        northPct: last?.northPct ?? null,
        v5: last?.v5 ?? null,
        v5Zone: v5Zone(last?.v5),
      },
      equityBond: {
        pe: ebLast?.pe ?? null,
        earningsYield: ebLast?.earningsYield ?? null,
        yield10yPct: ebLast?.yield10yPct ?? null,
        spreadValue: ebLast?.value ?? null,
        spreadPct: ebLast?.pct ?? null,
      },
    },
    multiPeriod: {
      hs300ReturnsPct: returnsPct,
      v5ZoneShare: {
        d60: share60,
        d120: share120,
      },
      equityBondChange: {
        spreadValueDelta: ebValChange,
        spreadPctDelta: ebPctChange,
      },
    },
    recent: {
      days: recentDays,
      hs300ReturnPct: recentClosePct,
      v5Delta: recentV5Delta,
      equityBondPctDelta: ebRecentPctDelta,
      rows: recentSlice.map((p) => {
        const eb = ebByDate.get(p.date)
        return {
          date: p.date,
          hs300Close: p.close,
          v5: p.v5,
          amountPct: p.amountPct,
          trPct: p.trPct,
          northPct: p.northPct,
          equityBondPct: eb?.pct ?? null,
          equityBondSpread: eb?.value ?? null,
        }
      }),
    },
    window: {
      days: windowDays,
      hs300ReturnPct: windowReturnPct,
      equityBondPct: {
        last: ebWindowPctNow,
        min: ebWindowPctMin,
        max: ebWindowPctMax,
      },
      rows: windowSlice.map((p) => {
        const eb = ebByDate.get(p.date)
        return {
          date: p.date,
          hs300Close: p.close,
          v5: p.v5,
          amountPct: p.amountPct,
          trPct: p.trPct,
          northPct: p.northPct,
          equityBondPct: eb?.pct ?? null,
          equityBondSpread: eb?.value ?? null,
        }
      }),
    },
  }

  return context
}
