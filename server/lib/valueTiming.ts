import { fetchGovBond10yYieldPctByDateSafe } from './chinamoneyGovBond.js'
import { fetchCsindexIndexPeSeries } from './csindex.js'
import { runAkshare } from './akshare.js'
import {
  readLatestValueTimingIndexSnapshot,
  readValueTimingIndexPointsRange,
  readValueTimingMeta,
  type ValueTimingIndexPointRow,
} from './supabaseRest.js'

function shouldVerboseLog(): boolean {
  const v = String(process.env.VALUE_TIMING_VERBOSE || '').trim()
  if (v === '1' || v.toLowerCase() === 'true') return true
  return String(process.env.GITHUB_ACTIONS || '').trim().toLowerCase() === 'true'
}

function logEvent(event: Record<string, unknown>) {
  if (!shouldVerboseLog()) return
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

type ValueTimingIndexConfig = {
  code: string
  name: string
  closeSource: 'csindex' | 'cnindex'
  closeCode: string
  peSource: 'csindex_indicator_xls' | 'etf_proxy' | 'public_api_then_etf'
  peIndexCode?: string
  peEtfCode?: string
}

export type ValueTimingDailyPoint = {
  date: string
  close: number
  ma60: number | null
  ma250: number | null
  bias60: number | null
  bias250: number | null
  biasPct3y60: number | null
  biasPct3y: number | null
  pe: number | null
  earningsYieldPct: number | null
  yield10yPct: number | null
  spreadPct: number | null
  spreadPctRank5y: number | null
  peSource: string | null
  peSourceNotes: string[]
}

type ValueTimingSummaryItem = {
  code: string
  latest: {
    date: string
    spreadPctRank5y: number | null
    pe: number | null
    earningsYieldPct: number | null
    biasPct3y: number | null
    biasPct3y60: number | null
    peSource: string | null
  } | null
  error?: string
  message?: string
}

const VALUE_TIMING_INDEXES: Record<string, ValueTimingIndexConfig> = {
  '932365': { code: '932365', name: '中证全指自由现金流', closeSource: 'csindex', closeCode: '932365', peSource: 'csindex_indicator_xls', peIndexCode: '932365' },
  '932315': { code: '932315', name: '中证全指红利质量', closeSource: 'csindex', closeCode: '932315', peSource: 'csindex_indicator_xls', peIndexCode: '932315' },
  '980081': { code: '980081', name: '国证价值100', closeSource: 'cnindex', closeCode: '980081', peSource: 'public_api_then_etf', peEtfCode: '159263' },
}

export function getValueTimingSupportedIndexCodes(): string[] {
  return Object.keys(VALUE_TIMING_INDEXES)
}

export function calcEarningsYieldPctFromPe(pe: number | null): number | null {
  if (pe == null || !Number.isFinite(pe) || pe <= 0) return null
  return 100 / pe
}

export function calcSpreadPct(earningsYieldPct: number | null, yield10yPct: number | null): number | null {
  if (earningsYieldPct == null || !Number.isFinite(earningsYieldPct)) return null
  if (yield10yPct == null || !Number.isFinite(yield10yPct)) return null
  return earningsYieldPct - yield10yPct
}

function normalizeYmd10(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return ''
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function dateFromYmd10(ymd10: string): Date | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

function ymd10MinusDays(ymd10: string, days: number): string | null {
  const d = dateFromYmd10(ymd10)
  if (!d) return null
  const ms = d.getTime() - Math.max(0, days) * 24 * 60 * 60 * 1000
  const nd = new Date(ms)
  return `${nd.getUTCFullYear()}-${pad2(nd.getUTCMonth() + 1)}-${pad2(nd.getUTCDate())}`
}

function ymd10FromYmd8(ymd8: string): string | null {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : v == null ? NaN : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
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

  const url = new URL('https://www.csindex.com.cn/csindex-home/perf/index-perf')
  url.searchParams.set('indexCode', indexCode)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json,text/plain,*/*',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`csindex failed: HTTP ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`)
  }
  const j = (await res.json().catch(() => null)) as any
  const rows = Array.isArray(j?.data) ? j.data : []
  const out: Array<{ date: string; close: number }> = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const d = normalizeYmd10((r as any).tradeDate)
    const c = toNum((r as any).close)
    if (!d || c == null) continue
    out.push({ date: d, close: c })
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
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
  const json = (await res.json().catch(() => null)) as any
  if (res.ok !== true) throw new Error(`cnindex hq request failed: ${res.status}`)
  if (json?.code !== 200) throw new Error(`cnindex hq response not ok: ${json?.code ?? 'unknown'}`)

  const rows = Array.isArray(json?.data?.data) ? json.data.data : []
  const out: Array<{ date: string; close: number }> = []
  for (const row of rows) {
    const ms = Array.isArray(row) ? row[0] : null
    const close = Array.isArray(row) ? row[1] : null
    if (typeof ms !== 'number' || !Number.isFinite(ms)) continue
    if (typeof close !== 'number' || !Number.isFinite(close)) continue
    const date = new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
    out.push({ date, close })
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

async function fetchEtfProxyPe(args: {
  etfCode: string
}): Promise<{ date: string | null; pe: number | null; error: string | null }> {
  const code = String(args.etfCode || '').trim()
  if (!/^\d{6}$/.test(code)) return { date: null, pe: null, error: 'bad_etf_code' }
  const secid = `0.${code}`
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}&fields=f58,f59,f60,f86,f92,f107,f111,f162`

  let lastErr: Error | null = null
  const maxAttemptsRaw = Number(process.env.ETF_PROXY_MAX_ATTEMPTS)
  const maxAttempts = Number.isFinite(maxAttemptsRaw) ? Math.max(1, Math.min(8, Math.floor(maxAttemptsRaw))) : 4
  const baseDelayRaw = Number(process.env.ETF_PROXY_BASE_DELAY_MS)
  const baseDelayMs = Number.isFinite(baseDelayRaw) ? Math.max(0, Math.min(15_000, Math.floor(baseDelayRaw))) : 900
  const startedAt = Date.now()
  logEvent({ event: 'value_timing.pe_proxy.start', etfCode: code, maxAttempts, baseDelayMs })
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ac = new AbortController()
      const timeoutMs = 12_000 + attempt * 2_000
      const id = setTimeout(() => ac.abort(), timeoutMs)
      let res: Response
      try {
        res = await fetch(url, {
          signal: ac.signal,
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json,text/plain,*/*' },
        })
      } finally {
        clearTimeout(id)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json().catch(() => null)) as any
      const data = j?.data && typeof j.data === 'object' ? j.data : null
      const peRaw = toNum(data?.f162)
      const pe = peRaw != null && peRaw > 0 ? peRaw : null
      logEvent({
        event: 'value_timing.pe_proxy.done',
        etfCode: code,
        attempt,
        timeoutMs,
        pe,
        ms: Date.now() - startedAt,
      })
      return { date: null, pe, error: pe == null ? (peRaw == null ? 'pe_missing' : 'pe_non_positive') : null }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < maxAttempts) {
        const waitMs = baseDelayMs * attempt + Math.floor(Math.random() * 250)
        logEvent({
          event: 'value_timing.pe_proxy.retry',
          etfCode: code,
          attempt,
          timeoutMs: 12_000 + attempt * 2_000,
          waitMs,
          error: String(lastErr.message || '').slice(0, 220),
        })
        await sleep(waitMs)
      } else {
        logEvent({
          event: 'value_timing.pe_proxy.fail',
          etfCode: code,
          attempt,
          timeoutMs: 12_000 + attempt * 2_000,
          ms: Date.now() - startedAt,
          error: String(lastErr.message || '').slice(0, 320),
        })
      }
    }
  }
  return { date: null, pe: null, error: lastErr?.message || 'fetch_failed' }
}

export async function fetchEtfProxyPeForTest(etfCode: string): Promise<{ date: string | null; pe: number | null; error: string | null }> {
  return await fetchEtfProxyPe({ etfCode })
}

async function fetchAkshareIndexPeSeries(args: {
  code: string
  startDate?: string
  endDate?: string
}): Promise<Array<{ date: string; pe: number }>> {
  const code = String(args.code || '').trim()
  if (!code) return []
  const startDate = normalizeYmd10(args.startDate)
  const endDate = normalizeYmd10(args.endDate)
  const cacheKey = `value-pe:akshare:${code}:${startDate || 'na'}:${endDate || 'na'}`
  const out = await runAkshare<{ series?: Array<{ date?: string; pe?: number | null }> }>(
    cacheKey,
    ['index-valuation', '--index-code', code, ...(startDate ? ['--start-date', startDate] : []), ...(endDate ? ['--end-date', endDate] : [])],
    { cacheTtlMs: 4 * 60 * 60_000, timeoutMs: 60_000 },
  )
  if (!out.success) return []
  const rows = Array.isArray(out.data?.series) ? out.data.series : []
  const series: Array<{ date: string; pe: number }> = []
  for (const r of rows) {
    const d = normalizeYmd10(r?.date)
    const pe = typeof r?.pe === 'number' && Number.isFinite(r.pe) && r.pe > 0 ? r.pe : null
    if (!d || pe == null) continue
    if (startDate && d < startDate) continue
    if (endDate && d > endDate) continue
    series.push({ date: d, pe })
  }
  series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return series
}

function buildRollingPercentile(values: Array<number | null>, window: number, minPeriods: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (!values.length || window <= 0) return out
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v == null) continue
    const w = Math.min(window, i + 1)
    const start = i - w + 1
    const slice: number[] = []
    for (let k = start; k <= i; k += 1) {
      const x = values[k]
      if (typeof x === 'number' && Number.isFinite(x)) slice.push(x)
    }
    const minP = Math.max(1, Math.min(minPeriods, Math.floor(w / 2)))
    if (slice.length < minP) continue
    let le = 0
    for (const x of slice) if (x <= v) le += 1
    out[i] = (le / slice.length) * 100
  }
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

function normalizeLegacyValuePoint(raw: unknown): ValueTimingDailyPoint | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const date = normalizeYmd10(o.date)
  const close = toNum(o.close)
  if (!date || close == null) return null
  const pe = toNum(o.pe)
  const earningsYieldPct = toNum(o.earningsYieldPct)
  const yield10yPct = toNum(o.yield10yPct)
  const spreadPctRaw = toNum(o.spreadPct)
  const spreadPct = spreadPctRaw ?? calcSpreadPct(earningsYieldPct, yield10yPct)
  const peSourceNotesRaw = o.peSourceNotes
  const peSourceNotes = Array.isArray(peSourceNotesRaw) ? peSourceNotesRaw.map((x) => String(x)) : []
  return {
    date,
    close,
    ma60: toNum(o.ma60),
    ma250: toNum(o.ma250),
    bias60: toNum(o.bias60),
    bias250: toNum(o.bias250),
    biasPct3y60: toNum(o.biasPct3y60),
    biasPct3y: toNum(o.biasPct3y),
    pe,
    earningsYieldPct,
    yield10yPct,
    spreadPct,
    spreadPctRank5y: toNum(o.spreadPctRank5y),
    peSource: typeof o.peSource === 'string' && o.peSource.trim() ? o.peSource.trim() : null,
    peSourceNotes,
  }
}

export function hydrateValueTimingSeriesWithDerivedMetrics(rawSeries: unknown): {
  series: ValueTimingDailyPoint[]
  hydrationApplied: boolean
  notes: string[]
} {
  const list = Array.isArray(rawSeries) ? rawSeries : []
  const normalized = list.map(normalizeLegacyValuePoint).filter((x): x is ValueTimingDailyPoint => Boolean(x))
  if (!normalized.length) return { series: [], hydrationApplied: false, notes: [] }

  const byDate = new Map<string, ValueTimingDailyPoint>()
  for (const p of normalized) byDate.set(p.date, p)
  const series = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const closes = series.map((p) => p.close)
  const ma60 = buildSma(closes, 60)
  const ma250 = buildSma(closes, 250)
  const bias60 = series.map((p, i) => {
    const ma = ma60[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const bias250 = series.map((p, i) => {
    const ma = ma250[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const biasPct3y60 = buildRollingPercentile(bias60, 1260, 252)
  const biasPct3y = buildRollingPercentile(bias250, 1260, 252)
  const spreads = series.map((p) => p.spreadPct ?? calcSpreadPct(p.earningsYieldPct, p.yield10yPct))
  const spreadRank = buildRollingPercentile(spreads, 1260, 630)

  let fillCount = 0
  for (let i = 0; i < series.length; i += 1) {
    if (series[i].ma60 == null && ma60[i] != null) {
      series[i].ma60 = ma60[i]
      fillCount += 1
    }
    if (series[i].ma250 == null && ma250[i] != null) {
      series[i].ma250 = ma250[i]
      fillCount += 1
    }
    if (series[i].bias60 == null && bias60[i] != null) {
      series[i].bias60 = bias60[i]
      fillCount += 1
    }
    if (series[i].bias250 == null && bias250[i] != null) {
      series[i].bias250 = bias250[i]
      fillCount += 1
    }
    if (series[i].biasPct3y60 == null && biasPct3y60[i] != null) {
      series[i].biasPct3y60 = biasPct3y60[i]
      fillCount += 1
    }
    if (series[i].biasPct3y == null && biasPct3y[i] != null) {
      series[i].biasPct3y = biasPct3y[i]
      fillCount += 1
    }
    const spread = spreads[i]
    if (series[i].spreadPct == null && spread != null) {
      series[i].spreadPct = spread
      fillCount += 1
    }
    if (series[i].spreadPctRank5y == null && spreadRank[i] != null) {
      series[i].spreadPctRank5y = spreadRank[i]
      fillCount += 1
    }
  }

  const notes: string[] = []
  if (fillCount > 0) {
    notes.push('derived_from_snapshot=1')
    notes.push('derived_fields=ma,bias,bias_pct,spread_rank')
    notes.push(`derived_fill_count=${fillCount}`)
  }
  return { series, hydrationApplied: fillCount > 0, notes }
}

const VALUE_RUN_STALE_MAX_DAYS = 14

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

function validateValuePointRows(rows: ValueTimingIndexPointRow[]): { ok: true } | { ok: false; error: string } {
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

function mapPointRowToDailyPoint(r: ValueTimingIndexPointRow): ValueTimingDailyPoint {
  return {
    date: r.data_date,
    close: r.close,
    ma60: r.ma60 ?? null,
    ma250: r.ma250 ?? null,
    bias60: r.bias60 ?? null,
    bias250: r.bias250 ?? null,
    biasPct3y60: r.bias_pct_3y_60 ?? null,
    biasPct3y: r.bias_pct_3y ?? null,
    pe: r.pe ?? null,
    earningsYieldPct: r.earnings_yield_pct ?? null,
    yield10yPct: r.yield10y_pct ?? null,
    spreadPct: r.spread_pct ?? null,
    spreadPctRank5y: r.spread_pct_rank_5y ?? null,
    peSource: r.pe_source ?? null,
    peSourceNotes: Array.isArray(r.pe_source_notes) ? (r.pe_source_notes as string[]) : [],
  }
}

async function getValueIndexSeriesFromSupabaseRuns(args: {
  code: string
  startDate?: string
  endDate?: string
}): Promise<{
  usedRunId: string | null
  fallbackReason: string | null
  fetchedAt: string
  dataDate: string | null
  notes: string[]
  series: ValueTimingDailyPoint[]
}> {
  const code = String(args.code || '').trim()
  const startYmd = normalizeYmd10(args.startDate) || '2016-01-01'
  const endYmd = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const meta = await readValueTimingMeta()
  const candidates = (meta?.historyRunIds || []).filter(Boolean)
  if (candidates.length === 0) throw new Error(`暂无可用 run：${code}`)

  let fallbackReason: string | null = null
  for (const runId of candidates) {
    const rows = await readValueTimingIndexPointsRange({ code, startDate: startYmd, endDate: endYmd, runId })
    if (!rows.length) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:empty` : `run=${runId}:empty`
      continue
    }
    const v = validateValuePointRows(rows)
    if ('error' in v) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:${v.error}` : `run=${runId}:${v.error}`
      continue
    }
    const lastDate = rows[rows.length - 1]?.data_date || ''
    const lag = lastDate ? diffDaysUtc(endYmd, lastDate) : null
    if (lag != null && lag > VALUE_RUN_STALE_MAX_DAYS) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:stale(${lag}d)` : `run=${runId}:stale(${lag}d)`
      continue
    }
    const hydrated = hydrateValueTimingSeriesWithDerivedMetrics(rows.map(mapPointRowToDailyPoint))
    return {
      usedRunId: runId,
      fallbackReason,
      fetchedAt: rows[rows.length - 1]?.fetched_at || new Date().toISOString(),
      dataDate: lastDate || null,
      notes: [
        ...(Array.isArray(rows[rows.length - 1]?.notes) ? (rows[rows.length - 1].notes as string[]) : []),
        ...(hydrated.hydrationApplied ? hydrated.notes.map((x) => (x === 'derived_from_snapshot=1' ? 'derived_from_run=1' : x)) : []),
      ],
      series: hydrated.series,
    }
  }

  throw new Error(`暂无可用价值择时数据：${code}${fallbackReason ? `（${fallbackReason}）` : ''}`)
}

export async function getValueTimingIndexSeries(args: {
  code: string
  startDate?: string
  endDate?: string
}): Promise<{
  meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
  data: { series: ValueTimingDailyPoint[] }
}> {
  const cfg = VALUE_TIMING_INDEXES[String(args.code || '').trim()]
  if (!cfg) throw new Error(`unsupported index code: ${String(args.code || '').trim()}`)

  const jobStartedAt = Date.now()
  logEvent({ event: 'value_timing.index.compute.start', code: cfg.code })

  const start = typeof args.startDate === 'string' ? args.startDate.trim() : ''
  const end = typeof args.endDate === 'string' ? args.endDate.trim() : ''
  const start8 = /^\d{8}$/.test(start) ? start : '20051230'
  const end8 = /^\d{8}$/.test(end) ? end : '20991231'

  const closeStartedAt = Date.now()
  const closeSeries =
    cfg.closeSource === 'cnindex'
      ? await fetchCnindexIndexCloseSeries({ indexCode: cfg.closeCode, startDate8: start8, endDate8: end8 })
      : await fetchCsindexIndexCloseSeries({ indexCode: cfg.closeCode, startDate: start8, endDate: end8 })
  if (!closeSeries.length) throw new Error(`close series empty: ${cfg.code}`)
  logEvent({ event: 'value_timing.index.close.done', code: cfg.code, points: closeSeries.length, ms: Date.now() - closeStartedAt })

  const peByDate = new Map<string, number | null>()
  const notes: string[] = []
  let peDirectPoints = 0
  if (cfg.peSource === 'csindex_indicator_xls') {
    const peStartedAt = Date.now()
    const firstDate = closeSeries[0]?.date
    const lastDate = closeSeries[closeSeries.length - 1]?.date
    const peStart8 = firstDate ? firstDate.replace(/-/g, '') : start8
    const peEnd8 = lastDate ? lastDate.replace(/-/g, '') : end8
    const series = await fetchCsindexIndexPeSeries({ indexCode: String(cfg.peIndexCode || cfg.code), startDate: peStart8, endDate: peEnd8 })
    for (const r of series) {
      const trade8 = typeof (r as any).trade_date === 'string' ? String((r as any).trade_date) : ''
      const pe = typeof (r as any).pe === 'number' ? (r as any).pe : null
      const d = ymd10FromYmd8(trade8)
      if (!d) continue
      peByDate.set(d, pe)
      if (pe != null && pe > 0) peDirectPoints += 1
    }
    notes.push(`pe_source=csindex:indexCsiDsPe`)
    notes.push(`pe_points=${series.length}`)
    notes.push(`pe_direct_points=${peDirectPoints}`)
    logEvent({ event: 'value_timing.index.pe_csindex.done', code: cfg.code, points: series.length, ms: Date.now() - peStartedAt })
  } else if (cfg.peSource === 'public_api_then_etf') {
    const peStartedAt = Date.now()
    const firstDate = closeSeries[0]?.date || null
    const lastDate = closeSeries[closeSeries.length - 1]?.date || null
    const apiSeries =
      firstDate && lastDate
        ? await fetchAkshareIndexPeSeries({ code: cfg.code, startDate: firstDate, endDate: lastDate })
        : []
    for (const r of apiSeries) {
      peByDate.set(r.date, r.pe)
      peDirectPoints += 1
    }
    notes.push(`pe_source=public_api:${cfg.code}`)
    notes.push(`pe_public_points=${apiSeries.length}`)
    if (!apiSeries.length) notes.push('pe_public_missing=1')
    logEvent({ event: 'value_timing.index.pe_public.result', code: cfg.code, points: apiSeries.length, ms: Date.now() - peStartedAt })

    if (!apiSeries.length) {
      const r = await fetchEtfProxyPe({ etfCode: String(cfg.peEtfCode || '') })
      if (r.error) notes.push(`pe_etf_proxy_error=${String(r.error).slice(0, 180)}`)
      if (r.pe != null) notes.push(`pe_source=fallback_etf_proxy:${cfg.peEtfCode}`)
      const lastDate2 = closeSeries[closeSeries.length - 1]?.date
      if (lastDate2 && r.pe != null) peByDate.set(lastDate2, r.pe)
      if (r.pe != null && r.pe > 0) peDirectPoints += 1
      logEvent({ event: 'value_timing.index.pe_proxy.fallback', code: cfg.code, etfCode: cfg.peEtfCode, pe: r.pe, error: r.error, ms: Date.now() - peStartedAt })
    }
  } else {
    const peStartedAt = Date.now()
    const r = await fetchEtfProxyPe({ etfCode: String(cfg.peEtfCode || '') })
    if (r.error) notes.push(`pe_etf_proxy_error=${String(r.error).slice(0, 180)}`)
    if (r.pe != null) notes.push(`pe_source=etf_proxy:${cfg.peEtfCode}`)
    const lastDate = closeSeries[closeSeries.length - 1]?.date
    if (lastDate && r.pe != null) peByDate.set(lastDate, r.pe)
    if (r.pe != null && r.pe > 0) peDirectPoints += 1
    logEvent({ event: 'value_timing.index.pe_proxy.result', code: cfg.code, etfCode: cfg.peEtfCode, pe: r.pe, error: r.error, ms: Date.now() - peStartedAt })
  }
  if (peDirectPoints === 0) notes.push('pe_direct_missing=1')
  if (closeSeries.length) {
    let withPe = 0
    for (const p of closeSeries) if (peByDate.get(p.date) != null) withPe += 1
    notes.push(`pe_cover=${withPe}/${closeSeries.length}`)
  }

  const years = new Set<number>()
  for (const p of closeSeries) {
    const y = Number(p.date.slice(0, 4))
    if (Number.isFinite(y)) years.add(y)
  }
  const yieldByDate = new Map<string, number>()
  const yieldFailYears: Array<{ year: number; error: string }> = []
  const sortedYears = Array.from(years).sort((a, b) => a - b)
  for (const y of sortedYears) {
    const yStartedAt = Date.now()
    logEvent({ event: 'value_timing.index.y10.year.start', code: cfg.code, year: y })
    const r = await fetchGovBond10yYieldPctByDateSafe({ year: y })
    if (r.error) {
      yieldFailYears.push({ year: y, error: r.error })
      logEvent({ event: 'value_timing.index.y10.year.fail', code: cfg.code, year: y, ms: Date.now() - yStartedAt, error: String(r.error).slice(0, 240) })
      continue
    }
    for (const [d, v] of r.map) yieldByDate.set(d, v)
    logEvent({ event: 'value_timing.index.y10.year.done', code: cfg.code, year: y, points: r.map.size, ms: Date.now() - yStartedAt })
  }
  if (yieldFailYears.length) {
    for (const it of yieldFailYears) notes.push(`yield10y_year_missing=${it.year}:${String(it.error).slice(0, 180)}`)
  }
  let yieldFallbackByDate: Map<string, number> | null = null
  let usedYieldFallback = false
  if (yieldFailYears.length || yieldByDate.size === 0) {
    const fbStartedAt = Date.now()
    const prev = await readLatestValueTimingIndexSnapshot(cfg.code).catch(() => null)
    const payload = prev?.payload && typeof prev.payload === 'object' ? (prev.payload as { series?: unknown }) : null
    const prevSeries = payload && Array.isArray(payload.series) ? (payload.series as Array<Record<string, unknown>>) : []
    const m = new Map<string, number>()
    for (const p of prevSeries) {
      const d = typeof p.date === 'string' ? p.date : ''
      const y10 = typeof p.yield10yPct === 'number' && Number.isFinite(p.yield10yPct) ? p.yield10yPct : null
      if (d && y10 != null) m.set(d, y10)
    }
    yieldFallbackByDate = m.size ? m : null
    if (yieldFallbackByDate) notes.push('yield10y_fallback=prev_snapshot')
    logEvent({ event: 'value_timing.index.y10.fallback', code: cfg.code, points: m.size, enabled: Boolean(yieldFallbackByDate), ms: Date.now() - fbStartedAt })
  }

  const spreads: Array<number | null> = []
  const peSources: Array<string | null> = []
  const peSourceNotesByDate = new Map<string, string[]>()
  const closes = closeSeries.map((p) => p.close)
  const ma60 = buildSma(closes, 60)
  const ma250 = buildSma(closes, 250)
  const bias60: Array<number | null> = closeSeries.map((p, i) => {
    const ma = ma60[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const bias250: Array<number | null> = closeSeries.map((p, i) => {
    const ma = ma250[i]
    if (ma == null || ma === 0) return null
    return (p.close - ma) / ma
  })
  const biasPct3y60 = buildRollingPercentile(bias60, 1260, 252)
  const biasPct3y = buildRollingPercentile(bias250, 1260, 252)
  const series: ValueTimingDailyPoint[] = []
  let lastPe: number | null = null
  let peForwardFilled = 0
  for (const p of closeSeries) {
    const direct = peByDate.has(p.date) ? peByDate.get(p.date)! : null
    const pe = direct != null && direct > 0 ? direct : lastPe
    if (direct != null && direct > 0) lastPe = direct
    else if (pe != null) peForwardFilled += 1
    peSources.push(direct != null && direct > 0 ? `direct:${cfg.peSource}` : pe != null ? `ffill:${cfg.peSource}` : null)
    if (cfg.code === '980081') {
      const notesByDate: string[] = []
      if (cfg.peSource === 'public_api_then_etf') {
        if (direct != null && direct > 0) notesByDate.push('pe_source=public_api')
        if (direct == null && pe != null) notesByDate.push(`pe_source=fallback_etf_ffill:${cfg.peEtfCode}`)
      } else {
        if (direct != null && direct > 0) notesByDate.push(`pe_source=etf:${cfg.peEtfCode}`)
        if (direct == null && pe != null) notesByDate.push(`pe_source=etf_ffill:${cfg.peEtfCode}`)
      }
      if (notesByDate.length) peSourceNotesByDate.set(p.date, notesByDate)
    }
    const earningsYieldPct = calcEarningsYieldPctFromPe(pe)
    let y10 = yieldByDate.get(p.date) ?? null
    if (y10 == null) {
      for (let i = 1; i <= 7; i += 1) {
        const prev = ymd10MinusDays(p.date, i)
        if (!prev) continue
        const hit = yieldByDate.get(prev)
        if (typeof hit === 'number' && Number.isFinite(hit)) {
          y10 = hit
          break
        }
      }
    }
    if (y10 == null && yieldFallbackByDate) {
      const direct = yieldFallbackByDate.get(p.date)
      if (typeof direct === 'number' && Number.isFinite(direct)) {
        y10 = direct
        usedYieldFallback = true
      } else {
        for (let i = 1; i <= 7; i += 1) {
          const prev = ymd10MinusDays(p.date, i)
          if (!prev) continue
          const hit = yieldFallbackByDate.get(prev)
          if (typeof hit === 'number' && Number.isFinite(hit)) {
            y10 = hit
            usedYieldFallback = true
            break
          }
        }
      }
    }
    const spread = calcSpreadPct(earningsYieldPct, y10)
    spreads.push(spread)
    series.push({
      date: p.date,
      close: p.close,
      ma60: null,
      ma250: null,
      bias60: null,
      bias250: null,
      biasPct3y60: null,
      biasPct3y: null,
      pe,
      earningsYieldPct,
      yield10yPct: y10,
      spreadPct: spread,
      spreadPctRank5y: null,
      peSource: null,
      peSourceNotes: [],
    })
  }
  if (peForwardFilled > 0) notes.push(`pe_forward_filled=${peForwardFilled}`)
  if (yieldByDate.size === 0) notes.push('yield10y_missing=all')
  if (usedYieldFallback) notes.push('yield10y_used_fallback=1')

  logEvent({
    event: 'value_timing.index.compute.done',
    code: cfg.code,
    closePoints: closeSeries.length,
    yieldPoints: yieldByDate.size,
    failYears: yieldFailYears.length,
    usedYieldFallback,
    ms: Date.now() - jobStartedAt,
  })

  const ranks = buildRollingPercentile(spreads, 1260, 630)
  for (let i = 0; i < series.length; i += 1) {
    series[i].ma60 = ma60[i]
    series[i].ma250 = ma250[i]
    series[i].bias60 = bias60[i]
    series[i].bias250 = bias250[i]
    series[i].biasPct3y60 = biasPct3y60[i]
    series[i].biasPct3y = biasPct3y[i]
    series[i].spreadPctRank5y = ranks[i]
    series[i].peSource = peSources[i] ?? null
    series[i].peSourceNotes = peSourceNotesByDate.get(series[i].date) ?? []
  }

  return {
    meta: {
      fetchedAt: new Date().toISOString(),
      dataDate: series.length ? series[series.length - 1].date : null,
      source: `computed:${cfg.code}`,
      notes,
    },
    data: { series },
  }
}

export async function getValueTimingSummary(): Promise<{
  meta: { fetchedAt: string; dataDate: string | null; source: string; notes: string[] }
  data: { items: ValueTimingSummaryItem[] }
}> {
  const fetchedAt = new Date().toISOString()
  const codes = getValueTimingSupportedIndexCodes()
  const items: ValueTimingSummaryItem[] = []
  let ok = 0
  let fail = 0
  let dataDate: string | null = null
  for (const code of codes) {
    try {
      const out = await getValueIndexSeriesFromSupabaseRuns({ code })
      const series = out.series
      const last = series.length ? series[series.length - 1] : null
      if (!last) {
        items.push({ code, latest: null, error: 'no_data', message: '暂无已发布数据' })
        fail += 1
        continue
      }
      const rowDate = out.dataDate || last.date || null
      if (rowDate && (!dataDate || rowDate > dataDate)) dataDate = rowDate
      items.push({
        code,
        latest: {
          date: last.date,
          spreadPctRank5y: last.spreadPctRank5y ?? null,
          pe: last.pe ?? null,
          earningsYieldPct: last.earningsYieldPct ?? null,
          biasPct3y: last.biasPct3y ?? null,
          biasPct3y60: last.biasPct3y60 ?? null,
          peSource: last.peSource ?? null,
        },
      })
      ok += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      items.push({ code, latest: null, error: 'no_data', message: msg || '暂无可用数据' })
      fail += 1
    }
  }

  return {
    meta: {
      fetchedAt,
      dataDate,
      source: 'supabase:value_timing_index_point',
      notes: [`ok=${ok}`, `fail=${fail}`],
    },
    data: { items },
  }
}

export async function getValueTimingIndexSnapshotSeries(args: {
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
  }
  data: { series: ValueTimingDailyPoint[] }
}> {
  const code = String(args.code || '').trim()
  const startYmd = normalizeYmd10(args.startDate)
  const endYmd = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  try {
    const out = await getValueIndexSeriesFromSupabaseRuns({ code, startDate: startYmd, endDate: endYmd })
    return {
      meta: {
        fetchedAt: out.fetchedAt,
        dataDate: out.dataDate,
        source: 'supabase:value_timing_index_point',
        notes: [...out.notes, ...(out.usedRunId ? [`run_id=${out.usedRunId}`] : []), ...(out.fallbackReason ? [`run_fallback=${out.fallbackReason}`] : [])],
        sourceType: 'supabase-table',
        snapshotAt: out.fetchedAt,
        stale: false,
      },
      data: { series: out.series },
    }
  } catch {
    const row = await readLatestValueTimingIndexSnapshot(code)
    if (!row) throw new Error(`暂无快照，请等待晚间刷新：${code}`)
    const payload = row.payload && typeof row.payload === 'object' ? (row.payload as { series?: unknown }) : null
    const hydrated = hydrateValueTimingSeriesWithDerivedMetrics(payload?.series)
    const full = hydrated.series
    const series =
      startYmd || endYmd
        ? full.filter((p) => {
            if (!p || typeof p !== 'object') return false
            const d = String((p as ValueTimingDailyPoint).date || '')
            if (!d) return false
            if (startYmd && d < startYmd) return false
            if (endYmd && d > endYmd) return false
            return true
          })
        : full

    return {
      meta: {
        fetchedAt: row.snapshot_at,
        dataDate: row.data_date ?? null,
        source: row.source ?? 'supabase:value_timing_index_daily',
        notes: [
          ...(Array.isArray(row.notes) ? (row.notes as string[]) : []),
          ...(hydrated.hydrationApplied ? hydrated.notes : []),
        ],
        sourceType: 'snapshot',
        snapshotAt: row.snapshot_at ?? null,
        stale: true,
      },
      data: { series },
    }
  }
}
