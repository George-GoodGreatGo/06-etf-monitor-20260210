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

function pctChange(values: number[], days: number): number | null {
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

export function buildMarketBoardInsightContextV2(input: {
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
  for (const h of horizons) returnsPct[`d${h}`] = pctChange(closes, h)

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
  const recentLiquidityIndex = recentSlice.map((p) => (isNum(p.v5) ? p.v5 : NaN)).filter((v) => Number.isFinite(v))
  const recentLiquidityIndexDelta = recentLiquidityIndex.length >= 2 ? recentLiquidityIndex[recentLiquidityIndex.length - 1] - recentLiquidityIndex[0] : null

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
  const windowDates = windowSlice.map((p) => p.date)
  const windowClose = windowSlice.map((p) => p.close)
  const windowLiquidityIndex = windowSlice.map((p) => p.v5)
  const windowAmountPct = windowSlice.map((p) => p.amountPct)
  const windowTrPct = windowSlice.map((p) => p.trPct)
  const windowNorthPct = windowSlice.map((p) => p.northPct)
  const windowEquityBondPct = windowSlice.map((p) => ebByDate.get(p.date)?.pct ?? null)
  const windowEquityBondSpread = windowSlice.map((p) => ebByDate.get(p.date)?.value ?? null)

  const context = {
    meta: {
      generatedAt: new Date().toISOString(),
      dataDate,
      windowDays,
      horizonsTradingDays: horizons,
      recentDays,
    },
    indicatorDictionary: {
      hs300Close: { meaning: '沪深300指数收盘点位', unit: '点', notes: '日线收盘价' },
      ema20: { meaning: 'EMA20：20日指数移动平均线', unit: '点', notes: '用于短中期趋势参考' },
      ema60: { meaning: 'EMA60：60日指数移动平均线', unit: '点', notes: '用于中期趋势参考' },
      priceVsEma20: { meaning: '收盘价与EMA20的差值', unit: '点', notes: '正值代表收盘在EMA20上方' },
      priceVsEma60: { meaning: '收盘价与EMA60的差值', unit: '点', notes: '正值代表收盘在EMA60上方' },
      boll120_mb: { meaning: 'BOLL120中轨（120日SMA）', unit: '点', notes: '布林带参数N=120,K=2.0' },
      boll120_ub: { meaning: 'BOLL120上轨', unit: '点', notes: '中轨 + 2*样本标准差' },
      boll120_lb: { meaning: 'BOLL120下轨', unit: '点', notes: '中轨 - 2*样本标准差' },
      boll120_bw: { meaning: 'BOLL120带宽', unit: '无量纲', notes: '(上轨-下轨)/中轨，反映波动收敛/扩张' },
      boll120_bwChangePct20d: { meaning: '带宽近20日相对变化', unit: '%', notes: '正值代表带宽扩张，负值代表收敛' },
      amount: { meaning: '两市成交额（沪+深）', unit: '千元', notes: '来自市场日度数据口径' },
      amountPct: { meaning: '成交额滚动分位数', unit: '%', notes: '0-100，越高代表成交越活跃' },
      tr: { meaning: '换手率（均值口径）', unit: '%', notes: '两市口径合成，越高代表交易更活跃' },
      trPct: { meaning: '换手率滚动分位数', unit: '%', notes: '0-100，越高代表换手更活跃' },
      northMoney: { meaning: '北向资金净流入', unit: '万元', notes: '正为净流入，负为净流出' },
      northPct: { meaning: '北向资金滚动分位数', unit: '%', notes: '0-100，越高代表相对更强的北向流入' },
      liquidityIndex: { meaning: '独家流动性指数（3指标）', unit: '无量纲', notes: '由成交额分位、换手率分位、北向分位合成；<30机会区，>70风险区' },
      liquidityZone: { meaning: '流动性指数区间标签', unit: '枚举', notes: 'opportunity/neutral/risk/unknown' },
      pe: { meaning: '沪深300市盈率', unit: '倍', notes: '来自指数估值口径' },
      earningsYield: { meaning: '盈利收益率', unit: '比率', notes: '约等于 1/PE' },
      yield10yPct: { meaning: '中国10年期国债收益率', unit: '%', notes: '百分数口径' },
      spreadValue: { meaning: '股债利差 value', unit: '比率', notes: '盈利收益率(比率) - 10Y收益率(比率)；若换算为%p：spreadValue*100' },
      spreadPct: { meaning: '股债利差滚动分位数', unit: '%', notes: '0-100，越高代表股票相对更有性价比' },
      hs300ReturnsPct: { meaning: '沪深300多周期涨跌幅', unit: '%', notes: 'd5/d20/d60/d120/d252' },
      liquidityZoneShare: { meaning: '流动性指数区间占比', unit: '%', notes: '在指定窗口内处于机会区/风险区的比例' },
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
        liquidityIndex: last?.v5 ?? null,
        liquidityZone: v5Zone(last?.v5),
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
      liquidityZoneShare: {
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
      liquidityIndexDelta: recentLiquidityIndexDelta,
      equityBondPctDelta: ebRecentPctDelta,
    },
    window: {
      days: windowDays,
      schema: {
        dates: 'YYYY-MM-DD[]',
        close: 'number[]',
        liquidityIndex: '(number|null)[]',
        amountPct: '(number|null)[]',
        trPct: '(number|null)[]',
        northPct: '(number|null)[]',
        equityBondPct: '(number|null)[]',
        equityBondSpread: '(number|null)[]',
      },
      dates: windowDates,
      close: windowClose,
      liquidityIndex: windowLiquidityIndex,
      amountPct: windowAmountPct,
      trPct: windowTrPct,
      northPct: windowNorthPct,
      equityBondPct: windowEquityBondPct,
      equityBondSpread: windowEquityBondSpread,
    },
  }

  return context
}
