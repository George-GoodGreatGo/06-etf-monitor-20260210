import { fetchGovBond10yYieldPctByDateWithFallbackSafe } from './chinamoneyGovBond.js'
import { readLowVolIndexPointsRange, readLowVolLatestPointsByCodes, readLowVolMeta, type LowVolIndexPointRow } from './supabaseRest.js'

type CacheEntry<T> = { expiresAt: number; value: T }
const cache = new Map<string, CacheEntry<unknown>>()
const readInflight = new Map<string, Promise<unknown>>()
const READ_CACHE_TTL_MS = 5 * 60_000
let csindexCooldownUntilMs = 0
const csindexInflight = new Map<string, Promise<Array<{ date: string; close: number }>>>()

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

function ymd10ToUtcMs(ymd10: string): number | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const ms = Date.UTC(y, m - 1, d)
  return Number.isFinite(ms) ? ms : null
}

function diffDaysUtc(aYmd10: string, bYmd10: string): number | null {
  const a = ymd10ToUtcMs(aYmd10)
  const b = ymd10ToUtcMs(bYmd10)
  if (a == null || b == null) return null
  return Math.floor((a - b) / 86_400_000)
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function readCacheGet<T>(key: string): T | null {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value as T
  return null
}

function readCacheSet<T>(key: string, value: T, ttlMs = READ_CACHE_TTL_MS) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value })
}

async function readCacheRemember<T>(key: string, task: () => Promise<T>, ttlMs = READ_CACHE_TTL_MS): Promise<T> {
  const hit = readCacheGet<T>(key)
  if (hit != null) return hit
  const inflight = readInflight.get(key)
  if (inflight) return inflight as Promise<T>
  const p = (async () => {
    const out = await task()
    readCacheSet(key, out, ttlMs)
    return out
  })().finally(() => {
    readInflight.delete(key)
  })
  readInflight.set(key, p as Promise<unknown>)
  return p
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
  const text = await res.text().catch(() => '')
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  const isWaf =
    normalized.includes('attack.jinxibei.com') ||
    normalized.includes('您的访问被阻断') ||
    normalized.includes('应用防火墙') ||
    normalized.includes('访问被阻断')
  if (isWaf) {
    throw new Error(`csindex blocked by WAF: HTTP ${res.status}（建议稍后重试或更换网络/出口IP）`)
  }
  if (!res.ok) {
    const brief = normalized ? normalized.slice(0, 240) : ''
    throw new Error(`csindex failed: HTTP ${res.status}${brief ? ` ${brief}` : ''}`)
  }
  const j = normalized ? (JSON.parse(normalized) as unknown) : null
  return j
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
  if (csindexCooldownUntilMs > now) {
    const untilIso = new Date(csindexCooldownUntilMs).toISOString()
    throw new Error(`csindex 熔断中，已暂停拉取（cooldownUntil=${untilIso}）`)
  }
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value as Array<{ date: string; close: number }>
  const inflight = csindexInflight.get(key)
  if (inflight) return inflight

  const task = (async () => {
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
        cache.set(key, { expiresAt: Date.now() + 10 * 60_000, value: out })
        return out
      } catch (e) {
        lastErr = e
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('csindex blocked by WAF')) {
          csindexCooldownUntilMs = Date.now() + 20 * 60_000
          break
        }
        if (i === 0) await sleep(250 + Math.floor(Math.random() * 400))
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  })().finally(() => {
    csindexInflight.delete(key)
  })

  csindexInflight.set(key, task)
  return task
}

function normalizeCsindexIndexCode(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const dot = s.indexOf('.')
  if (dot <= 0) return s
  const head = s.slice(0, dot)
  return /^\d+$/.test(head) ? head : s
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
  dataSource?: 'csindex' | 'cnindex'
}

function ymd8ToDash(ymd8: string): string {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) throw new Error(`invalid ymd8: ${s}`)
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

async function fetchCnindexIndexCloseSeries(args: {
  indexCode: string
  startDate8: string
  endDate8: string
}): Promise<Array<{ date: string; close: number }>> {
  const indexCode = String(args.indexCode || '').trim()
  const startDate = ymd8ToDash(args.startDate8)
  const endDate = ymd8ToDash(args.endDate8)
  if (!indexCode) return []

  const qs = new URLSearchParams({ indexCode, startDate, endDate })
  const url = `https://hq.cnindex.com.cn/market/market/getIndexDailyData?${qs.toString()}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://www.cnindex.com.cn/',
    },
  })
  const json = (await res.json().catch(() => null)) as unknown
  const payload =
    json && typeof json === 'object'
      ? (json as {
          code?: unknown
          data?: { data?: unknown }
        })
      : null
  if (res.ok !== true) throw new Error(`cnindex hq request failed: ${res.status}`)
  if (payload?.code !== 200) throw new Error(`cnindex hq response not ok: ${typeof payload?.code === 'number' ? payload.code : 'unknown'}`)

  const rows = Array.isArray(payload?.data?.data) ? payload.data.data : []
  const out: Array<{ date: string; close: number }> = []
  for (const row of rows) {
    const ms = Array.isArray(row) ? row[0] : null
    const close = Array.isArray(row) ? row[1] : null
    if (typeof ms !== 'number' || !Number.isFinite(ms)) continue
    if (typeof close !== 'number' || !Number.isFinite(close)) continue
    const date = new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
    out.push({ date, close })
  }
  return out
}

const LOWVOL_INDEXES: Record<string, LowVolIndexConfig> = {
  H30269: { code: 'H30269', name: '红利低波', priCode: 'H30269', triCode: 'H20269' },
  '399986': { code: '399986', name: '中证银行', priCode: '399986', triCode: 'H20180' },
  H30022: { code: 'H30022', name: '中证800银行', priCode: 'H30022', triCode: 'H20022' },
  '930740.CSI': { code: '930740.CSI', name: '沪深300红利低波动', priCode: '930740', triCode: 'H20740' },
  '931847.CSI': { code: '931847.CSI', name: '中证500红利低波动', priCode: '931847', triCode: '931847CNY010' },
  '931848.CSI': { code: '931848.CSI', name: '中证800红利低波动', priCode: '931848', triCode: '931848CNY010' },
  '930955': { code: '930955', name: '中证红利低波动100', priCode: '930955', triCode: 'H20955' },
  '932365': { code: '932365', name: '自由现金流', priCode: '932365', triCode: '932365CNY010' },
  '932315': { code: '932315', name: '中证红利质量', priCode: '932315', triCode: '932315CNY010' },
  '980081': { code: '980081', name: '国证价值100', priCode: '980081', triCode: '480081', dataSource: 'cnindex' },
}

const LOWVOL_RUN_STALE_MAX_DAYS = 14

function validateLowVolPointRows(rows: LowVolIndexPointRow[]): { ok: true } | { ok: false; error: string } {
  if (!rows.length) return { ok: false, error: 'empty' }
  let prev = ''
  let dup = 0
  let nonInc = 0
  let closeOk = 0
  const seen = new Set<string>()
  for (const r of rows) {
    const d = String(r.data_date || '')
    if (!d) continue
    if (seen.has(d)) dup += 1
    seen.add(d)
    if (prev && d <= prev) nonInc += 1
    prev = d
    if (typeof r.close === 'number' && Number.isFinite(r.close)) closeOk += 1
  }
  if (dup > 0 || nonInc > 0) return { ok: false, error: `bad_date_series(dup=${dup},nonInc=${nonInc})` }
  if (closeOk === 0) return { ok: false, error: 'no_valid_close' }
  return { ok: true }
}

function mapPointRowToDailyPoint(r: LowVolIndexPointRow): LowVolDailyPoint {
  return {
    date: r.data_date,
    close: r.close,
    ma60: r.ma60 ?? null,
    ma250: r.ma250 ?? null,
    bias60: r.bias60 ?? null,
    bias250: r.bias250 ?? null,
    biasPct3y60: r.bias_pct_3y_60 ?? null,
    biasPct3y: r.bias_pct_3y ?? null,
    dividendYieldPct: r.dividend_yield_pct ?? null,
    yield10yPct: r.yield10y_pct ?? null,
    spreadRawPct: r.spread_raw_pct ?? null,
    spreadSmoothPct: r.spread_smooth_pct ?? null,
    spreadPct: r.spread_pct ?? null,
    spreadPctRank3y: r.spread_pct_rank_3y ?? null,
    spreadPctRank10y: r.spread_pct_rank_10y ?? null,
  }
}

async function getLowVolIndexSeriesFromSupabaseRuns(args: {
  code: string
  startDate?: string
  endDate?: string
}): Promise<{
  usedRunId: string | null
  fallbackReason: string | null
  fetchedAt: string
  dataDate: string | null
  notes: string[]
  series: LowVolDailyPoint[]
}> {
  const code = String(args.code || '').trim().toUpperCase()
  const startYmd = normalizeYmd10(args.startDate) || '2016-01-01'
  const endYmd = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const meta = await readLowVolMeta()
  const candidates = (meta?.historyRunIds || []).filter(Boolean)
  if (candidates.length === 0) throw new Error(`暂无可用 run：${code}`)

  let fallbackReason: string | null = null
  for (const runId of candidates) {
    const rows = await readLowVolIndexPointsRange({ code, startDate: startYmd, endDate: endYmd, runId })
    if (!rows.length) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:empty` : `run=${runId}:empty`
      continue
    }
    const v = validateLowVolPointRows(rows)
    if ('error' in v) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:${v.error}` : `run=${runId}:${v.error}`
      continue
    }
    const lastDate = rows[rows.length - 1]?.data_date || ''
    const lag = lastDate ? diffDaysUtc(endYmd, lastDate) : null
    if (lag != null && lag > LOWVOL_RUN_STALE_MAX_DAYS) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:stale(${lag}d)` : `run=${runId}:stale(${lag}d)`
      continue
    }
    return {
      usedRunId: runId,
      fallbackReason,
      fetchedAt: rows[rows.length - 1]?.fetched_at || new Date().toISOString(),
      dataDate: lastDate || null,
      notes: Array.isArray(rows[rows.length - 1]?.notes) ? (rows[rows.length - 1].notes as string[]) : [],
      series: rows.map(mapPointRowToDailyPoint),
    }
  }

  const rows = await readLowVolIndexPointsRange({ code, startDate: startYmd, endDate: endYmd })
  if (rows.length) {
    const v = validateLowVolPointRows(rows)
    if (!('error' in v)) {
      const lastDate = rows[rows.length - 1]?.data_date || ''
      const lag = lastDate ? diffDaysUtc(endYmd, lastDate) : null
      if (lag == null || lag <= LOWVOL_RUN_STALE_MAX_DAYS) {
        return {
          usedRunId: null,
          fallbackReason: fallbackReason ? `${fallbackReason}; run=all:ok` : 'run=all:ok',
          fetchedAt: rows[rows.length - 1]?.fetched_at || new Date().toISOString(),
          dataDate: lastDate || null,
          notes: Array.isArray(rows[rows.length - 1]?.notes) ? (rows[rows.length - 1].notes as string[]) : [],
          series: rows.map(mapPointRowToDailyPoint),
        }
      }
      fallbackReason = fallbackReason ? `${fallbackReason}; run=all:stale(${lag}d)` : `run=all:stale(${lag}d)`
    } else {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=all:${v.error}` : `run=all:${v.error}`
    }
  } else {
    fallbackReason = fallbackReason ? `${fallbackReason}; run=all:empty` : 'run=all:empty'
  }

  throw new Error(`暂无可用低波数据：${code}${fallbackReason ? `（${fallbackReason}）` : ''}`)
}

export function getLowVolSupportedIndexCodes(): string[] {
  return Object.keys(LOWVOL_INDEXES)
}

export async function fetchLowVolIndexCloseSeries(args: {
  code: string
  kind: 'pri' | 'tri'
  startDate8: string
  endDate8: string
}): Promise<Array<{ date: string; close: number }>> {
  const cfg = LOWVOL_INDEXES[String(args.code || '').trim().toUpperCase()]
  if (!cfg) return []
  const start8 = String(args.startDate8 || '').trim()
  const end8 = String(args.endDate8 || '').trim()
  if (!/^\d{8}$/.test(start8) || !/^\d{8}$/.test(end8)) return []

  const dataSource = cfg.dataSource ?? 'csindex'
  const rawIndexCode =
    args.kind === 'tri'
      ? cfg.triCode
      : cfg.priCode
  if (!rawIndexCode) return []

  if (dataSource === 'cnindex') {
    return fetchCnindexIndexCloseSeries({ indexCode: rawIndexCode, startDate8: start8, endDate8: end8 })
  }
  return fetchCsindexIndexCloseSeries({
    indexCode: normalizeCsindexIndexCode(rawIndexCode),
    startDate: start8,
    endDate: end8,
  })
}

type LowVolLatestSummary = {
  date: string
  spreadPctRank10y: number | null
  biasPct3y: number | null
  biasPct3y60: number | null
  dividendYieldPct: number | null
}

export type LowVolSummaryItem = {
  code: string
  latest: LowVolLatestSummary | null
  sourceType?: 'snapshot' | 'supabase-table'
  snapshotAt?: string | null
  stale?: boolean
  error?: string
  message?: string
}

let lowVolSummaryCache: { expiresAt: number; value: { meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }; data: { items: LowVolSummaryItem[] } } } | null =
  null
let lowVolSummaryInflight: Promise<{
  meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
  data: { items: LowVolSummaryItem[] }
}> | null = null

export async function getLowVolSummary(): Promise<{
  meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
  data: { items: LowVolSummaryItem[] }
}> {
  const cacheKey = 'lowvol:summary:v1'
  const hit = readCacheGet<{
    meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
    data: { items: LowVolSummaryItem[] }
  }>(cacheKey)
  if (hit) return hit

  const now = Date.now()
  if (lowVolSummaryCache && lowVolSummaryCache.expiresAt > now) return lowVolSummaryCache.value
  if (lowVolSummaryInflight) return lowVolSummaryInflight

  lowVolSummaryInflight = (async () => {
    const fetchedAt = new Date().toISOString()
    const codes = getLowVolSupportedIndexCodes()
    const items: LowVolSummaryItem[] = []
    const endDate = new Date().toISOString().slice(0, 10)
    const meta = await readLowVolMeta()
    const runIds = (meta?.historyRunIds || []).filter(Boolean)
    const latestRows = await readLowVolLatestPointsByCodes({ codes, endDate, runIds })
    let ok = 0
    let fail = 0
    let dataDate: string | null = null
    for (const it of latestRows) {
      const row = it.row
      if (!row) {
        items.push({ code: it.code, latest: null, sourceType: 'supabase-table', snapshotAt: null, stale: true, error: 'no_data', message: it.fallbackReason || '暂无可用数据' })
        fail += 1
        continue
      }
      const lag = row.data_date ? diffDaysUtc(endDate, row.data_date) : null
      const stale = lag != null && lag > LOWVOL_RUN_STALE_MAX_DAYS
      if (row.data_date && (!dataDate || row.data_date > dataDate)) dataDate = row.data_date
      items.push({
        code: it.code,
        latest: {
          date: row.data_date,
          spreadPctRank10y: row.spread_pct_rank_10y ?? null,
          biasPct3y: row.bias_pct_3y ?? null,
          biasPct3y60: row.bias_pct_3y_60 ?? null,
          dividendYieldPct: row.dividend_yield_pct ?? null,
        },
        sourceType: 'supabase-table',
        snapshotAt: row.fetched_at,
        stale,
      })
      ok += 1
    }

    const value = {
      meta: {
        fetchedAt,
        dataDate,
        source: 'supabase:lowvol_index_point',
        notes: [`ok=${ok}`, `fail=${fail}`],
      },
      data: { items },
    }
    lowVolSummaryCache = { expiresAt: now + 2 * 60_000, value }
    readCacheSet(cacheKey, value)
    return value
  })().finally(() => {
    lowVolSummaryInflight = null
  })

  return lowVolSummaryInflight
}

export async function getLowVolIndexSnapshotSeries(args: {
  code: string
  startDate?: string
  endDate?: string
}): Promise<{
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    sourceType: 'snapshot' | 'supabase-table'
    snapshotAt: string | null
    stale: boolean
    cooldownUntil?: string | null
  }
  data: { series: LowVolDailyPoint[] }
}> {
  const code = String(args.code || '').trim().toUpperCase()
  const startYmd = normalizeYmd10(args.startDate)
  const endYmd = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const cacheKey = `lowvol:index:${code}:${startYmd || 'na'}:${endYmd}`
  return await readCacheRemember(cacheKey, async () => {
    const out = await getLowVolIndexSeriesFromSupabaseRuns({ code, startDate: startYmd, endDate: endYmd })
    const series = out.series
    const cooldownUntil = csindexCooldownUntilMs > Date.now() ? new Date(csindexCooldownUntilMs).toISOString() : null
    return {
      meta: {
        fetchedAt: out.fetchedAt,
        dataDate: out.dataDate,
        source: 'supabase:lowvol_index_point',
        notes: [...out.notes, ...(out.usedRunId ? [`run_id=${out.usedRunId}`] : []), ...(out.fallbackReason ? [`run_fallback=${out.fallbackReason}`] : [])],
        sourceType: 'supabase-table',
        snapshotAt: out.fetchedAt,
        stale: false,
        ...(cooldownUntil ? { cooldownUntil } : {}),
      },
      data: { series },
    }
  })
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

  const dataSource = cfg.dataSource ?? 'csindex'
  const closeSeries =
    dataSource === 'cnindex'
      ? await fetchCnindexIndexCloseSeries({ indexCode: cfg.priCode, startDate8: start8, endDate8: end8 })
      : await fetchCsindexIndexCloseSeries({
          indexCode: normalizeCsindexIndexCode(cfg.priCode),
          startDate: start8,
          endDate: end8,
        })
  if (!cfg.triCode) throw new Error(`TRI 数据未配置，无法计算股息率/利差：${cfg.code}`)
  const triSeries =
    dataSource === 'cnindex'
      ? await fetchCnindexIndexCloseSeries({ indexCode: cfg.triCode, startDate8: start8, endDate8: end8 })
      : await fetchCsindexIndexCloseSeries({
          indexCode: normalizeCsindexIndexCode(cfg.triCode),
          startDate: start8,
          endDate: end8,
        })
  const triByDate = new Map<string, number>()
  for (const p of triSeries) triByDate.set(p.date, p.close)
  if (!triSeries.length) throw new Error(`TRI 数据为空，无法计算股息率/利差：${cfg.code}`)
  let overlap = 0
  for (const p of closeSeries) if (triByDate.has(p.date)) overlap += 1
  if (overlap < 253) {
    const priLast = closeSeries.length ? closeSeries[closeSeries.length - 1].date : ''
    const triLast = triSeries.length ? triSeries[triSeries.length - 1].date : ''
    throw new Error(
      `TRI 数据不足或无法对齐，无法计算股息率/利差：${cfg.code}（priLen=${closeSeries.length}, triLen=${triSeries.length}, overlap=${overlap}, priLast=${priLast}, triLast=${triLast}, range=${start8}-${end8}）`,
    )
  }

  const closes = closeSeries.map((p) => p.close)
  const ma60 = buildSma(closes, 60)
  const bias60: Array<number | null> = closeSeries.map((p, i) => {
    const ma = ma60[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const biasPct3y60 = buildRollingPercentile(bias60, 1260, 252)
  const ma250 = buildSma(closes, 250)
  const bias250: Array<number | null> = closeSeries.map((p, i) => {
    const ma = ma250[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const biasPct3y = buildRollingPercentile(bias250, 1260, 252)

  const y10ByDate = new Map<string, number>()
  const y10FailYears: Array<{ year: number; error: string }> = []
  const y10SourceByYear: Array<{ year: number; source: 'chinamoney' | 'baostock' }> = []
  const y10FallbackYears: number[] = []
  if (closeSeries.length) {
    const y0 = Number(closeSeries[0].date.slice(0, 4))
    const y1 = Number(closeSeries[closeSeries.length - 1].date.slice(0, 4))
    const startYear = Number.isFinite(y0) ? y0 : new Date().getUTCFullYear()
    const endYear = Number.isFinite(y1) ? y1 : new Date().getUTCFullYear()
    for (let y = startYear; y <= endYear; y += 1) {
      const r = await fetchGovBond10yYieldPctByDateWithFallbackSafe({ year: y })
      if (r.error) {
        y10FailYears.push({ year: y, error: r.error })
        continue
      }
      for (const [d, v] of r.map.entries()) y10ByDate.set(d, v)
      if (r.source) y10SourceByYear.push({ year: y, source: r.source })
      if (r.fallbackUsed) y10FallbackYears.push(y)
    }
  }
  const y10PrimaryYears = y10SourceByYear.filter((it) => it.source === 'chinamoney').map((it) => it.year)
  const y10BaostockYears = y10SourceByYear.filter((it) => it.source === 'baostock').map((it) => it.year)

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
  const spreadPctRank10y = buildRollingPercentile(spreadCorePct, 1260, 252)

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
    source: `${dataSource} + govbond10y`,
    notes: [
      `指数：${cfg.name}（${cfg.code}）。`,
      dataSource === 'cnindex'
        ? `指数点位数据源：cnindex（hq.cnindex.com.cn getIndexDailyData，priCode=${cfg.priCode}）。`
        : `指数点位数据源：csindex（index-perf，priCode=${cfg.priCode}）。`,
      dataSource === 'cnindex'
        ? `全收益指数数据源：cnindex（hq.cnindex.com.cn getIndexDailyData，triCode=${cfg.triCode}）。`
        : `全收益指数数据源：csindex（index-perf，triCode=${cfg.triCode}）。`,
      '股息收益率口径（修正）：先用价格指数PRI与全收益指数TRI的滚动1年（252交易日）推算分红回报 DividendReturn(1Y)= (TRI_t/TRI_{t-252}) / (PRI_t/PRI_{t-252}) - 1，再换算分红点数 D_t=PRI_t*DividendReturn(1Y)，对 D_t 做250日SMA（minPeriods=126），最后用 股息率_t = D_SMA_t / PRI_t。',
      '利差口径（核心）：spreadCore=股息收益率(修正)-10Y。',
      '利差分位：基于spreadCore做5年滚动分位（window≈1260，minPeriods=252）。',
      '乖离率BIAS口径：60日/250日简单移动平均，BIAS=(close-ma)/ma。',
      '滚动分位数窗口：BIAS分位与利差分位均为5年≈1260个交易日（最小有效252个样本）。',
      `yield10y_source_coverage=chinamoney:[${y10PrimaryYears.join(',') || '-'}];baostock:[${y10BaostockYears.join(',') || '-'}]`,
      `yield10y_fallback_triggered=${y10FallbackYears.length > 0 ? '1' : '0'}`,
      y10FallbackYears.length > 0 ? `yield10y_fallback_source=baostock years=[${y10FallbackYears.join(',')}]` : '',
      y10FailYears.length ? `yield10y_primary_failed=${y10FailYears.length}` : '',
      ...y10FailYears.map((it) => `yield10y_year_missing=${it.year}:${String(it.error).slice(0, 180)}`),
      y10ByDate.size > 0 ? '' : 'yield10y_unavailable=no_live_source',
      '10Y国债收益率数据源：chinamoney主源 + baostock回退。',
    ].filter(Boolean),
  }

  return { meta, data: { series } }
}

export async function getLowVolH30269Series(args?: { startDate?: string; endDate?: string }) {
  const start = normalizeYmd10(args?.startDate)
  const end = normalizeYmd10(args?.endDate) || ''
  const cacheKey = `lowvol:h30269:${start || 'na'}:${end || 'na'}`
  return await readCacheRemember(cacheKey, async () => {
    return await getLowVolIndexSeries({ code: 'H30269', startDate: args?.startDate, endDate: args?.endDate })
  })
}

