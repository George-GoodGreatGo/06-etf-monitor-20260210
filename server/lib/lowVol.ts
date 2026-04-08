import * as XLSX from 'xlsx'
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
  ma250: number | null
  bias250: number | null
  biasPct3y: number | null
  dividendYieldPct: number | null
  yield10yPct: number | null
  spreadPct: number | null
  spreadPctRank3y: number | null
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json,text/plain,*/*',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`csindex failed: HTTP ${res.status} ${text}`)
  }
  return res.json().catch(() => null)
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`download failed: HTTP ${res.status} ${text}`)
  }
  return Buffer.from(await res.arrayBuffer())
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

async function fetchCsindexDividendYieldRecentDp2(args: { indexCode: string }): Promise<Map<string, number>> {
  const indexCode = String(args.indexCode || '').trim()
  if (!indexCode) return new Map()

  const key = `csindex:indicator-xls:dp2:${indexCode}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value as Map<string, number>

  const detailUrl = new URL('https://www.csindex.com.cn/csindex-home/indexInfo/index-details-data')
  detailUrl.searchParams.set('fileLang', '2')
  detailUrl.searchParams.set('indexCode', indexCode)
  const j = (await fetchJson(detailUrl.toString())) as Record<string, unknown>
  const row0 = Array.isArray(j?.data) ? ((j.data as Record<string, unknown>[])[0] as Record<string, unknown> | undefined) : undefined
  const fileUrl = row0 && typeof row0.indicator === 'string' ? String(row0.indicator).trim() : ''
  if (!fileUrl) return new Map()

  const buf = await fetchBinary(fileUrl)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : null
  if (!ws) return new Map()
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[]
  const out = new Map<string, number>()
  for (const r of rows.slice(1)) {
    if (!Array.isArray(r)) continue
    const d = normalizeYmd10(r[0])
    const dp2 = toNum(r[5])
    if (!d || dp2 == null) continue
    out.set(d, dp2)
  }
  cache.set(key, { expiresAt: now + 10 * 60_000, value: out })
  return out
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

export async function getLowVolH30269Series(args?: {
  startDate?: string
  endDate?: string
}): Promise<{
  meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
  data: { series: LowVolDailyPoint[] }
}> {
  const start = typeof args?.startDate === 'string' ? args.startDate.trim() : ''
  const end = typeof args?.endDate === 'string' ? args.endDate.trim() : ''
  const start8 = /^\d{8}$/.test(start) ? start : '20051230'
  const end8 = /^\d{8}$/.test(end) ? end : '20991231'

  const closeSeries = await fetchCsindexIndexCloseSeries({ indexCode: 'H30269', startDate: start8, endDate: end8 })
  const triSeries = await fetchCsindexIndexCloseSeries({ indexCode: 'H20269', startDate: start8, endDate: end8 })
  const triByDate = new Map<string, number>()
  for (const p of triSeries) triByDate.set(p.date, p.close)

  const closes = closeSeries.map((p) => p.close)
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

  const dividendYieldPct: Array<number | null> = closeSeries.map((p, i) => {
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
    return Number.isFinite(divReturn) ? divReturn * 100 : null
  })
  const yield10yPct: Array<number | null> = closeSeries.map((p) => y10ByDate.get(p.date) ?? null)
  const spreadPct: Array<number | null> = closeSeries.map((p, i) => {
    const dy = dividendYieldPct[i]
    const y = yield10yPct[i]
    if (dy == null || y == null) return null
    return dy - y
  })
  const spreadPctRank3y = buildRollingPercentile(spreadPct, 756, 252)

  const series: LowVolDailyPoint[] = closeSeries.map((p, i) => ({
    date: p.date,
    close: p.close,
    ma250: ma250[i],
    bias250: bias250[i],
    biasPct3y: biasPct3y[i],
    dividendYieldPct: dividendYieldPct[i],
    yield10yPct: yield10yPct[i],
    spreadPct: spreadPct[i],
    spreadPctRank3y: spreadPctRank3y[i],
  }))

  const last = series.length ? series[series.length - 1] : null
  const meta = {
    fetchedAt: new Date().toISOString(),
    dataDate: last?.date ?? null,
    source: 'csindex + chinamoney',
    notes: [
      '指数点位数据源：csindex（index-perf）。',
      '股息率口径：使用价格指数 H30269 与全收益指数 H20269 的滚动1年“股息收益率”推算：DividendReturn(1Y)= (TRI_t/TRI_{t-252}) / (PRI_t/PRI_{t-252}) - 1。',
      '乖离率BIAS口径：250日简单移动平均，BIAS=(close-ma250)/ma250。',
      '滚动分位数窗口：3年≈756个交易日（最小有效252个样本）。',
      '10Y国债收益率数据源：chinamoney。',
    ],
  }

  return { meta, data: { series } }
}

