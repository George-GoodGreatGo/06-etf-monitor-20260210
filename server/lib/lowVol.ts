import { fetchGovBond10yYieldPctByDate } from './chinamoneyGovBond.js'

type CacheEntry<T> = { expiresAt: number; value: T }
const cache = new Map<string, CacheEntry<unknown>>()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function ymd8ToYmd10(ymd8: string): string {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function normalizeYmd10(ymd: unknown): string {
  const s = String(ymd || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{8}$/.test(s)) return ymd8ToYmd10(s)
  return ''
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export type LowVolDailyPoint = {
  date: string
  close: number
  ma60: number | null
  ma250: number | null
  bias60: number | null
  bias250: number | null
  biasPct3y60: number | null
  biasPct3y: number | null
  dividendYieldPct: number | null
  yield10yPct: number | null
  spreadRawPct: number | null
  spreadSmoothPct: number | null
  spreadPct: number | null
  spreadPctRank3y: number | null
  spreadPctRank10y: number | null
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://www.csindex.com.cn/',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`csindex failed: HTTP ${res.status} ${text}`)
  }
  return res.json().catch(() => null)
}

async function fetchCsindexIndexCloseSeries(args: {
  indexCode: string
  startDate: string
  endDate: string
}): Promise<Array<{ date: string; close: number }>> {
  const indexCode = String(args.indexCode || '').trim()
  const startDate = String(args.startDate || '').trim()
  const endDate = String(args.endDate || '').trim()
  if (!indexCode || !/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate)) return []

  const key = `csindex:index-perf:${indexCode}:${startDate}:${endDate}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value as Array<{ date: string; close: number }>

  const url = new URL('https://www.csindex.com.cn/csindex-home/perf/index-perf')
  url.searchParams.set('indexCode', indexCode)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)

  let lastErr: unknown = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const j = (await fetchJson(url.toString())) as Record<string, unknown>
      const rows = Array.isArray(j?.data) ? (j.data as Record<string, unknown>[]) : []
      const out: Array<{ date: string; close: number }> = []
      for (const r of rows) {
        const d = normalizeYmd10((r as Record<string, unknown>).tradeDate)
        const c = toNum((r as Record<string, unknown>).close)
        if (!d || c == null) continue
        out.push({ date: d, close: c })
      }
      out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      cache.set(key, { expiresAt: now + 10 * 60_000, value: out })
      return out
    } catch (e) {
      lastErr = e
      if (i === 0) await sleep(250)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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

function buildSmaNullable(values: Array<number | null>, period: number, minPeriods: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (!values.length || period <= 0) return out
  const minP = Math.max(1, Math.min(period, minPeriods))
  let sum = 0
  let cnt = 0
  for (let i = 0; i < values.length; i += 1) {
    const vAdd = values[i]
    if (typeof vAdd === 'number' && Number.isFinite(vAdd)) {
      sum += vAdd
      cnt += 1
    }
    if (i >= period) {
      const vDrop = values[i - period]
      if (typeof vDrop === 'number' && Number.isFinite(vDrop)) {
        sum -= vDrop
        cnt -= 1
      }
    }
    if (i >= period - 1 && cnt >= minP) out[i] = sum / cnt
  }
  return out
}

function buildRollingPercentile(values: Array<number | null>, window: number, minPeriods: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (!values.length || window <= 0) return out
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v == null) continue
    const start = Math.max(0, i - window + 1)
    const slice: number[] = []
    for (let k = start; k <= i; k += 1) {
      const x = values[k]
      if (typeof x === 'number' && Number.isFinite(x)) slice.push(x)
    }
    if (slice.length < minPeriods) continue
    let le = 0
    for (const x of slice) if (x <= v) le += 1
    out[i] = (le / slice.length) * 100
  }
  return out
}

type LowVolIndexConfig = {
  code: string
  name: string
  priCode: string
  triCode: string | null
}

const LOWVOL_INDEXES: Record<string, LowVolIndexConfig> = {
  H30269: { code: 'H30269', name: '红利低波', priCode: 'H30269', triCode: 'H20269' },
  '932365': { code: '932365', name: '中证全指自由现金流', priCode: '932365', triCode: '932365CNY010' },
  '932315': { code: '932315', name: '中证全指红利质量', priCode: '932315', triCode: '932315CNY010' },
}

export function getLowVolSupportedIndexCodes(): string[] {
  return Object.keys(LOWVOL_INDEXES)
}

export async function getLowVolIndexSeries(args: {
  code: string
  startDate?: string
  endDate?: string
}): Promise<{
  meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
  data: { series: LowVolDailyPoint[] }
}> {
  const cfg = LOWVOL_INDEXES[String(args.code || '').trim().toUpperCase()]
  if (!cfg) throw new Error(`unsupported index code: ${String(args.code || '').trim()}`)

  const start = typeof args.startDate === 'string' ? args.startDate.trim() : ''
  const end = typeof args.endDate === 'string' ? args.endDate.trim() : ''
  const start8 = /^\d{8}$/.test(start) ? start : '20051230'
  const end8 = /^\d{8}$/.test(end) ? end : '20991231'

  const closeSeries = await fetchCsindexIndexCloseSeries({ indexCode: cfg.priCode, startDate: start8, endDate: end8 })
  if (!cfg.triCode) throw new Error(`TRI 数据未配置，无法计算股息率/利差：${cfg.code}`)
  const triSeries = await fetchCsindexIndexCloseSeries({ indexCode: cfg.triCode, startDate: start8, endDate: end8 })
  const triByDate = new Map<string, number>()
  for (const p of triSeries) triByDate.set(p.date, p.close)
  if (!triSeries.length) throw new Error(`TRI 数据为空，无法计算股息率/利差：${cfg.code}`)
  let overlap = 0
  for (const p of closeSeries) if (triByDate.has(p.date)) overlap += 1
  if (overlap < 253) throw new Error(`TRI 数据不足或无法对齐，无法计算股息率/利差：${cfg.code}`)

  const closes = closeSeries.map((p) => p.close)
  const ma60 = buildSma(closes, 60)
  const bias60: Array<number | null> = closeSeries.map((p, i) => {
    const ma = ma60[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const biasPct3y60 = buildRollingPercentile(bias60, 756, 252)
  const ma250 = buildSma(closes, 250)
  const bias250: Array<number | null> = closeSeries.map((p, i) => {
    const ma = ma250[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const biasPct3y = buildRollingPercentile(bias250, 756, 252)

  const y10ByDate = new Map<string, number>()
  if (closeSeries.length) {
    const y0 = Number(closeSeries[0].date.slice(0, 4))
    const y1 = Number(closeSeries[closeSeries.length - 1].date.slice(0, 4))
    const startYear = Number.isFinite(y0) ? y0 : new Date().getUTCFullYear()
    const endYear = Number.isFinite(y1) ? y1 : new Date().getUTCFullYear()
    for (let y = startYear; y <= endYear; y += 1) {
      try {
        const m = await fetchGovBond10yYieldPctByDate({ year: y })
        for (const [d, v] of m.entries()) y10ByDate.set(d, v)
      } catch {
        void 0
      }
    }
  }

  const dividendPointsRaw: Array<number | null> = closeSeries.map((p, i) => {
    const lookback = i - 252
    if (lookback < 0) return null
    const priNow = p.close
    const priThen = closeSeries[lookback]?.close
    const triNow = triByDate.get(p.date)
    const triThen = triByDate.get(closeSeries[lookback]?.date)
    if (priThen == null || priThen === 0) return null
    if (triNow == null || triThen == null || triThen === 0) return null
    const priceFactor = priNow / priThen
    const totalFactor = triNow / triThen
    const divFactor = totalFactor / priceFactor
    const divReturn = divFactor - 1
    if (!(typeof divReturn === 'number' && Number.isFinite(divReturn))) return null
    const d = priNow * divReturn
    return typeof d === 'number' && Number.isFinite(d) ? d : null
  })
  const dividendPointsSma = buildSmaNullable(dividendPointsRaw, 250, 126)
  const dividendYieldPct: Array<number | null> = closeSeries.map((p, i) => {
    const d = dividendPointsSma[i]
    if (d == null || p.close === 0) return null
    const y = (d / p.close) * 100
    return Number.isFinite(y) ? y : null
  })
  const yield10yPct: Array<number | null> = closeSeries.map((p) => y10ByDate.get(p.date) ?? null)
  const spreadCorePct: Array<number | null> = closeSeries.map((p, i) => {
    const dy = dividendYieldPct[i]
    const y = yield10yPct[i]
    if (dy == null || y == null) return null
    return dy - y
  })
  const spreadRawPct = spreadCorePct
  const spreadSmoothPct = spreadCorePct
  const spreadPct = spreadCorePct
  const spreadPctRank3y = buildRollingPercentile(spreadCorePct, 756, 252)
  const spreadPctRank10y = buildRollingPercentile(spreadCorePct, 2520, 252)

  const series: LowVolDailyPoint[] = closeSeries.map((p, i) => ({
    date: p.date,
    close: p.close,
    ma60: ma60[i],
    ma250: ma250[i],
    bias60: bias60[i],
    bias250: bias250[i],
    biasPct3y60: biasPct3y60[i],
    biasPct3y: biasPct3y[i],
    dividendYieldPct: dividendYieldPct[i],
    yield10yPct: yield10yPct[i],
    spreadRawPct: spreadRawPct[i],
    spreadSmoothPct: spreadSmoothPct[i],
    spreadPct: spreadPct[i],
    spreadPctRank3y: spreadPctRank3y[i],
    spreadPctRank10y: spreadPctRank10y[i],
  }))

  const last = series.length ? series[series.length - 1] : null
  const meta = {
    fetchedAt: new Date().toISOString(),
    dataDate: last?.date ?? null,
    source: 'csindex + chinamoney',
    notes: [
      `指数：${cfg.name}（${cfg.code}）。`,
      `指数点位数据源：csindex（index-perf，priCode=${cfg.priCode}）。`,
      `全收益指数数据源：csindex（index-perf，triCode=${cfg.triCode}）。`,
      '股息收益率口径（修正）：先用价格指数PRI与全收益指数TRI的滚动1年（252交易日）推算分红回报 DividendReturn(1Y)= (TRI_t/TRI_{t-252}) / (PRI_t/PRI_{t-252}) - 1，再换算分红点数 D_t=PRI_t*DividendReturn(1Y)，对 D_t 做250日SMA（minPeriods=126），最后用 股息率_t = D_SMA_t / PRI_t。',
      '利差口径（核心）：spreadCore=股息收益率(修正)-10Y。',
      '利差分位：基于spreadCore做10年滚动分位（window≈2520，minPeriods=252）。',
      '乖离率BIAS口径：60日/250日简单移动平均，BIAS=(close-ma)/ma。',
      '滚动分位数窗口：3年≈756个交易日（最小有效252个样本）。',
      '10Y国债收益率数据源：chinamoney。',
    ].filter(Boolean),
  }

  return { meta, data: { series } }
}

export async function getLowVolH30269Series(args?: { startDate?: string; endDate?: string }) {
  return getLowVolIndexSeries({ code: 'H30269', startDate: args?.startDate, endDate: args?.endDate })
}

