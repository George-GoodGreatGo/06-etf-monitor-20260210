import { fetchGovBond10yYieldPctByDateSafe } from './chinamoneyGovBond.js'
import { fetchCsindexIndexValuationSeries } from './csindexIndexValuation.js'
import { readLatestValueTimingIndexSnapshot, readLatestValueTimingIndexSnapshots } from './supabaseRest.js'

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
  peSource: 'csindex_indicator_xls' | 'etf_proxy'
  peIndexCode?: string
  peEtfCode?: string
}

export type ValueTimingDailyPoint = {
  date: string
  close: number
  pe: number | null
  earningsYieldPct: number | null
  yield10yPct: number | null
  spreadPct: number | null
  spreadPctRank5y: number | null
}

type ValueTimingSummaryItem = {
  code: string
  latest: { date: string; spreadPctRank5y: number | null; pe: number | null; earningsYieldPct: number | null } | null
  error?: string
  message?: string
}

const VALUE_TIMING_INDEXES: Record<string, ValueTimingIndexConfig> = {
  '932365': { code: '932365', name: '中证全指自由现金流', closeSource: 'csindex', closeCode: '932365', peSource: 'csindex_indicator_xls', peIndexCode: '932365' },
  '932315': { code: '932315', name: '中证全指红利质量', closeSource: 'csindex', closeCode: '932315', peSource: 'csindex_indicator_xls', peIndexCode: '932315' },
  '980081': { code: '980081', name: '国证价值100', closeSource: 'cnindex', closeCode: '980081', peSource: 'etf_proxy', peEtfCode: '159605' },
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
      const pe = toNum(data?.f162)
      logEvent({
        event: 'value_timing.pe_proxy.done',
        etfCode: code,
        attempt,
        timeoutMs,
        pe,
        ms: Date.now() - startedAt,
      })
      return { date: null, pe, error: pe == null ? 'pe_missing' : null }
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
  if (cfg.peSource === 'csindex_indicator_xls') {
    const peStartedAt = Date.now()
    const series = await fetchCsindexIndexValuationSeries({ indexCode: String(cfg.peIndexCode || cfg.code) })
    for (const p of series) peByDate.set(p.date, p.pe)
    notes.push(`pe_source=csindex_indicator_xls`)
    notes.push(`pe_points=${series.length}`)
    logEvent({ event: 'value_timing.index.pe_csindex.done', code: cfg.code, points: series.length, ms: Date.now() - peStartedAt })
  } else {
    const peStartedAt = Date.now()
    const r = await fetchEtfProxyPe({ etfCode: String(cfg.peEtfCode || '') })
    if (r.error) notes.push(`pe_etf_proxy_error=${String(r.error).slice(0, 180)}`)
    if (r.pe != null) notes.push(`pe_source=etf_proxy:${cfg.peEtfCode}`)
    const lastDate = closeSeries[closeSeries.length - 1]?.date
    if (lastDate && r.pe != null) peByDate.set(lastDate, r.pe)
    logEvent({ event: 'value_timing.index.pe_proxy.result', code: cfg.code, etfCode: cfg.peEtfCode, pe: r.pe, error: r.error, ms: Date.now() - peStartedAt })
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
  const series: ValueTimingDailyPoint[] = []
  for (const p of closeSeries) {
    const pe = peByDate.has(p.date) ? peByDate.get(p.date)! : null
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
      pe,
      earningsYieldPct,
      yield10yPct: y10,
      spreadPct: spread,
      spreadPctRank5y: null,
    })
  }
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
  for (let i = 0; i < series.length; i += 1) series[i].spreadPctRank5y = ranks[i]

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
  const latestMap = await readLatestValueTimingIndexSnapshots(codes)
  let ok = 0
  let fail = 0
  let dataDate: string | null = null
  for (const code of codes) {
    const row = latestMap.get(code) ?? null
    const payload = row?.payload && typeof row.payload === 'object' ? (row.payload as { series?: unknown }) : null
    const series = payload && Array.isArray(payload.series) ? (payload.series as ValueTimingDailyPoint[]) : []
    const last = series.length ? series[series.length - 1] : null
    if (!row || !last) {
      items.push({ code, latest: null, error: 'no_snapshot', message: '暂无快照，请等待晚间刷新' })
      fail += 1
      continue
    }
    if (!dataDate || row.data_date > dataDate) dataDate = row.data_date
    items.push({
      code,
      latest: { date: last.date, spreadPctRank5y: last.spreadPctRank5y ?? null, pe: last.pe ?? null, earningsYieldPct: last.earningsYieldPct ?? null },
    })
    ok += 1
  }

  return {
    meta: {
      fetchedAt,
      dataDate,
      source: 'supabase:value_timing_index_daily',
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
    sourceType: 'snapshot'
    snapshotAt: string | null
    stale: boolean
  }
  data: { series: ValueTimingDailyPoint[] }
}> {
  const code = String(args.code || '').trim()
  const row = await readLatestValueTimingIndexSnapshot(code)
  if (!row) throw new Error(`暂无快照，请等待晚间刷新：${code}`)

  const payload = row.payload && typeof row.payload === 'object' ? (row.payload as { series?: unknown }) : null
  const full = payload && Array.isArray(payload.series) ? (payload.series as ValueTimingDailyPoint[]) : []

  const startYmd = normalizeYmd10(args.startDate)
  const endYmd = normalizeYmd10(args.endDate)
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
      notes: Array.isArray(row.notes) ? (row.notes as string[]) : [],
      sourceType: 'snapshot',
      snapshotAt: row.snapshot_at ?? null,
      stale: true,
    },
    data: { series },
  }
}
