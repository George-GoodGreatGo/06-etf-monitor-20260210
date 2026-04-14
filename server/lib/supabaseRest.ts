type Top100LatestRow = {
  id: number
  fetched_at: string
  data_date: string
  cached_at: string | null
  source: string | null
  notes: unknown
  rows: unknown
  updated_at: string
}

export type Top100InsightRow = {
  data_date: string
  snapshot_at: string | null
  source: string | null
  rows: unknown
  markdown: string
  created_at: string
  updated_at: string
}

export type Top100InsightStatus = 'idle' | 'generating' | 'ready' | 'failed'

export type Top100InsightStatusRow = {
  data_date: string
  status: Top100InsightStatus
  last_error: string | null
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export type EtfWeeklyInsightRow = {
  code: string
  insight_text: string
  created_at: string
}

export type MarketBoardDailyRow = {
  data_date: string
  fetched_at: string
  source_type: string | null
  source: string | null
  notes: unknown
  payload: unknown
  updated_at: string
}

export type MarketBoardPointRow = {
  run_id: string
  data_date: string
  fetched_at: string
  source_type: string | null
  source: string | null
  notes: unknown
  close: number
  amount: number | null
  tr: number | null
  north_money: number | null
  amount_pct: number | null
  tr_pct: number | null
  north_pct: number | null
  v5: number | null
  v5_pct: number | null
  pe: number | null
  earnings_yield: number | null
  yield10y_pct: number | null
  equity_bond_value: number | null
  equity_bond_pct: number | null
  updated_at: string
}

export type MarketBoardMetaRow = {
  currentRunId: string
  previousRunId: string | null
  historyRunIds: string[]
  currentDataDate: string | null
  publishStatus: string
  qualitySummary: Record<string, unknown> | null
}

function uniqueNonEmptyRunIds(list: unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const s = typeof raw === 'string' ? raw.trim() : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export async function readMarketBoardMeta(): Promise<MarketBoardMetaRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const readKey = serviceKey || anonKey
  if (!supabaseUrl || !readKey) return null

  const urlV2 =
    `${supabaseUrl}/rest/v1/market_board_meta?id=eq.default` +
    `&select=current_run_id,previous_run_id,history_run_ids,current_data_date,publish_status,quality_summary`
  const resV2 = await fetch(urlV2, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  const jV2 = (await resV2.json().catch(() => null)) as unknown
  if (resV2.ok && Array.isArray(jV2) && jV2.length > 0) {
    const first = jV2[0] as Record<string, unknown>
    const currentRunId = typeof first.current_run_id === 'string' ? first.current_run_id : ''
    const previousRunId = typeof first.previous_run_id === 'string' ? first.previous_run_id : null
    const historyRaw = Array.isArray(first.history_run_ids) ? first.history_run_ids : []
    const historyRunIds = uniqueNonEmptyRunIds([currentRunId, ...historyRaw, previousRunId].filter(Boolean))
    const currentDataDate = typeof first.current_data_date === 'string' ? first.current_data_date : null
    const publishStatus = typeof first.publish_status === 'string' ? first.publish_status : 'idle'
    const qualitySummary =
      first.quality_summary && typeof first.quality_summary === 'object' ? (first.quality_summary as Record<string, unknown>) : null
    if (!currentRunId) return null
    return { currentRunId, previousRunId, historyRunIds, currentDataDate, publishStatus, qualitySummary }
  }

  const urlV1 = `${supabaseUrl}/rest/v1/market_board_meta?id=eq.default&select=current_run_id,previous_run_id`
  const resV1 = await fetch(urlV1, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  if (!resV1.ok) return null
  const j = (await resV1.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0] as Record<string, unknown>
  const currentRunId = typeof first.current_run_id === 'string' ? first.current_run_id : ''
  const previousRunId = typeof first.previous_run_id === 'string' ? first.previous_run_id : null
  if (!currentRunId) return null
  return {
    currentRunId,
    previousRunId,
    historyRunIds: uniqueNonEmptyRunIds([currentRunId, previousRunId].filter(Boolean)),
    currentDataDate: null,
    publishStatus: 'idle',
    qualitySummary: null,
  }
}

export async function upsertMarketBoardMeta(args: {
  currentRunId: string
  previousRunId: string | null
  historyRunIds?: string[]
  currentDataDate?: string | null
  publishStatus?: string
  qualitySummary?: Record<string, unknown> | null
}): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const currentRunId = String(args.currentRunId || '').trim()
  const previousRunId = args.previousRunId ? String(args.previousRunId).trim() : null
  const historyRunIds = uniqueNonEmptyRunIds([currentRunId, ...(args.historyRunIds || []), previousRunId].filter(Boolean))
  const currentDataDate = args.currentDataDate ? String(args.currentDataDate).trim() : null
  const publishStatus = args.publishStatus ? String(args.publishStatus).trim() : 'idle'
  const qualitySummary = args.qualitySummary && typeof args.qualitySummary === 'object' ? args.qualitySummary : {}
  if (!currentRunId) throw new Error('missing currentRunId')

  const url = `${supabaseUrl}/rest/v1/market_board_meta?on_conflict=id`
  const row = {
    id: 'default',
    current_run_id: currentRunId,
    previous_run_id: previousRunId,
    history_run_ids: historyRunIds,
    current_data_date: currentDataDate || null,
    publish_status: publishStatus,
    quality_summary: qualitySummary,
    updated_at: new Date().toISOString(),
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write market_board_meta failed: HTTP ${res.status} ${body}`)
  }
}

export type LowVolIndexDailyRow = {
  id: string
  code: string
  data_date: string
  snapshot_at: string
  source_type: string | null
  source: string | null
  notes: unknown
  payload: unknown
  updated_at: string
}

export type ValueTimingIndexDailyRow = {
  id: string
  code: string
  data_date: string
  snapshot_at: string
  source_type: string | null
  source: string | null
  notes: unknown
  payload: unknown
  updated_at: string
}

export async function readTop100LatestSnapshot(): Promise<Top100LatestRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  if (!supabaseUrl || !anonKey) return null

  const url = `${supabaseUrl}/rest/v1/top100_latest?id=eq.1&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json()) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as Top100LatestRow
}

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

export async function readTop100InsightByDataDate(dataDate: string): Promise<Top100InsightRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const d = String(dataDate || '').trim()
  if (!supabaseUrl || !anonKey || !d) return null

  const url = `${supabaseUrl}/rest/v1/top100_insight?data_date=eq.${encodeURIComponent(d)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as Top100InsightRow
}

export async function insertTop100InsightIgnoreDuplicates(payload: {
  data_date: string
  snapshot_at: string | null
  source: string | null
  rows: unknown
  markdown: string
  updated_at?: string
}): Promise<Top100InsightRow | null> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const p = payload && typeof payload === 'object' ? payload : null
  if (!p) throw new Error('bad payload')

  const dataDate = String(p.data_date || '').trim()
  if (!dataDate) throw new Error('missing data_date')
  const markdown = String(p.markdown || '')
  if (!markdown.trim()) throw new Error('missing markdown')

  const row = {
    data_date: dataDate,
    snapshot_at: p.snapshot_at ? String(p.snapshot_at) : null,
    source: p.source ? String(p.source) : null,
    rows: p.rows,
    markdown,
    updated_at: p.updated_at ? String(p.updated_at) : new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/top100_insight?on_conflict=data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write failed: HTTP ${res.status} ${body}`)
  }

  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as Top100InsightRow
}

export async function readTop100InsightStatusByDataDate(dataDate: string): Promise<Top100InsightStatusRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const d = String(dataDate || '').trim()
  if (!supabaseUrl || !anonKey || !d) return null

  const url = `${supabaseUrl}/rest/v1/top100_insight_status?data_date=eq.${encodeURIComponent(d)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as Top100InsightStatusRow
}

export async function upsertTop100InsightStatus(payload: {
  data_date: string
  status: Top100InsightStatus
  last_error?: string | null
  started_at?: string | null
  finished_at?: string | null
  updated_at?: string
}): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const p = payload && typeof payload === 'object' ? payload : null
  if (!p) throw new Error('bad payload')

  const dataDate = String(p.data_date || '').trim()
  if (!dataDate) throw new Error('missing data_date')
  const status = p.status

  const row = {
    data_date: dataDate,
    status,
    last_error: p.last_error ?? null,
    started_at: p.started_at ?? null,
    finished_at: p.finished_at ?? null,
    updated_at: p.updated_at ? String(p.updated_at) : new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/top100_insight_status?on_conflict=data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write top100_insight_status failed: HTTP ${res.status} ${body}`)
  }
}

export async function readEtfWeeklyInsight(code: string): Promise<EtfWeeklyInsightRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const c = String(code || '').trim()
  if (!supabaseUrl || !anonKey || !c) return null

  const url = `${supabaseUrl}/rest/v1/etf_weekly_insight?code=eq.${encodeURIComponent(c)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as EtfWeeklyInsightRow
}

export async function upsertEtfWeeklyInsight(code: string, insightText: string): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const c = String(code || '').trim()
  const t = String(insightText || '').trim()
  if (!c || !t) return

  const row = {
    code: c,
    insight_text: t,
    created_at: new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/etf_weekly_insight?on_conflict=code`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`supabase write etf_weekly_insight failed: HTTP ${res.status} ${body}`)
  }
}

export async function readLatestMarketBoardSnapshot(): Promise<MarketBoardDailyRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  if (!supabaseUrl || !anonKey) return null

  const url = `${supabaseUrl}/rest/v1/market_board_daily?select=*&order=data_date.desc&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as MarketBoardDailyRow
}

export async function readMarketBoardSnapshotByDate(dataDate: string): Promise<MarketBoardDailyRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const d = String(dataDate || '').trim()
  if (!supabaseUrl || !anonKey || !d) return null

  const url = `${supabaseUrl}/rest/v1/market_board_daily?data_date=eq.${encodeURIComponent(d)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as MarketBoardDailyRow
}

export async function readMarketBoardPointsRange(args: {
  startDate: string
  endDate: string
  runId?: string | null
}): Promise<MarketBoardPointRow[]> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const readKey = serviceKey || anonKey
  const start = String(args.startDate || '').trim()
  const end = String(args.endDate || '').trim()
  const runId = args.runId ? String(args.runId).trim() : ''
  if (!supabaseUrl || !readKey || !start || !end) return []

  const url =
    `${supabaseUrl}/rest/v1/market_board_point?` +
    `select=*&data_date=gte.${encodeURIComponent(start)}&data_date=lte.${encodeURIComponent(end)}` +
    (runId ? `&run_id=eq.${encodeURIComponent(runId)}` : '') +
    `&order=data_date.asc`
  const res = await fetch(url, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  if (!res.ok) return []
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return []
  return j.filter((x) => x && typeof x === 'object') as MarketBoardPointRow[]
}

export async function upsertMarketBoardPoints(payload: Array<Omit<MarketBoardPointRow, 'updated_at'>>): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const list = Array.isArray(payload) ? payload : []
  if (list.length === 0) return

  const url = `${supabaseUrl}/rest/v1/market_board_point?on_conflict=run_id,data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(list.map((r) => ({ ...r, updated_at: new Date().toISOString() }))),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write market_board_point failed: HTTP ${res.status} ${body}`)
  }
}

export async function deleteMarketBoardPointsRange(args: { startDate: string; endDate: string }): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const start = String(args.startDate || '').trim()
  const end = String(args.endDate || '').trim()
  if (!start || !end) return

  const url =
    `${supabaseUrl}/rest/v1/market_board_point?` +
    `data_date=gte.${encodeURIComponent(start)}&data_date=lte.${encodeURIComponent(end)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase delete market_board_point failed: HTTP ${res.status} ${body}`)
  }
}

export async function deleteMarketBoardPointsBefore(args: { beforeDate: string }): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const before = String(args.beforeDate || '').trim()
  if (!before) return

  const url = `${supabaseUrl}/rest/v1/market_board_point?data_date=lt.${encodeURIComponent(before)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase delete market_board_point(before) failed: HTTP ${res.status} ${body}`)
  }
}

export async function deleteMarketBoardPointsNotInRuns(args: { keepRunIds: string[] }): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const keep = Array.isArray(args.keepRunIds) ? args.keepRunIds.map((x) => String(x || '').trim()).filter(Boolean) : []
  if (keep.length === 0) return

  const list = keep.map((x) => `%22${encodeURIComponent(x.replace(/"/g, ''))}%22`).join(',')
  const url = `${supabaseUrl}/rest/v1/market_board_point?run_id=not.in.(${list})`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase delete market_board_point(not-in runs) failed: HTTP ${res.status} ${body}`)
  }
}

export async function upsertMarketBoardSnapshot(payload: {
  data_date: string
  fetched_at: string
  source_type?: string | null
  source?: string | null
  notes?: unknown
  payload: unknown
  updated_at?: string
}): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const p = payload && typeof payload === 'object' ? payload : null
  if (!p) throw new Error('bad payload')

  const dataDate = String(p.data_date || '').trim()
  const fetchedAt = String(p.fetched_at || '').trim()
  if (!dataDate) throw new Error('missing data_date')
  if (!fetchedAt) throw new Error('missing fetched_at')

  const row = {
    data_date: dataDate,
    fetched_at: fetchedAt,
    source_type: p.source_type ?? null,
    source: p.source ?? null,
    notes: p.notes ?? [],
    payload: p.payload,
    updated_at: p.updated_at ? String(p.updated_at) : new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/market_board_daily?on_conflict=data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write market_board_daily failed: HTTP ${res.status} ${body}`)
  }
}

export async function readLatestLowVolIndexSnapshot(code: string): Promise<LowVolIndexDailyRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const c = String(code || '').trim()
  const readKey = anonKey || serviceKey
  if (!supabaseUrl || !readKey || !c) return null

  const url = `${supabaseUrl}/rest/v1/lowvol_index_daily?code=eq.${encodeURIComponent(c)}&select=*&order=data_date.desc&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as LowVolIndexDailyRow
}

export async function readLatestLowVolIndexSnapshots(codes: string[]): Promise<Map<string, LowVolIndexDailyRow>> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const list = Array.isArray(codes) ? codes.map((x) => String(x || '').trim()).filter(Boolean) : []
  const out = new Map<string, LowVolIndexDailyRow>()
  const readKey = anonKey || serviceKey
  if (!supabaseUrl || !readKey || list.length === 0) return out

  const inList = list.map((x) => encodeURIComponent(x)).join(',')
  const url = `${supabaseUrl}/rest/v1/lowvol_index_daily?code=in.(${inList})&select=*&order=code.asc,data_date.desc`
  const res = await fetch(url, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  if (!res.ok) return out
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return out
  for (const row of j) {
    if (!row || typeof row !== 'object') continue
    const r = row as LowVolIndexDailyRow
    const c = typeof r.code === 'string' ? r.code : ''
    if (!c || out.has(c)) continue
    out.set(c, r)
  }
  return out
}

export async function upsertLowVolIndexSnapshot(payload: {
  code: string
  data_date: string
  snapshot_at: string
  source_type?: string | null
  source?: string | null
  notes?: unknown
  payload: unknown
  updated_at?: string
}): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const p = payload && typeof payload === 'object' ? payload : null
  if (!p) throw new Error('bad payload')

  const code = String(p.code || '').trim()
  const dataDate = String(p.data_date || '').trim()
  const snapshotAt = String(p.snapshot_at || '').trim()
  if (!code) throw new Error('missing code')
  if (!dataDate) throw new Error('missing data_date')
  if (!snapshotAt) throw new Error('missing snapshot_at')

  const row = {
    code,
    data_date: dataDate,
    snapshot_at: snapshotAt,
    source_type: p.source_type ?? null,
    source: p.source ?? null,
    notes: p.notes ?? [],
    payload: p.payload,
    updated_at: p.updated_at ? String(p.updated_at) : new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/lowvol_index_daily?on_conflict=code,data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write lowvol_index_daily failed: HTTP ${res.status} ${body}`)
  }
}

export async function readLatestValueTimingIndexSnapshot(code: string): Promise<ValueTimingIndexDailyRow | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const c = String(code || '').trim()
  const readKey = anonKey || serviceKey
  if (!supabaseUrl || !readKey || !c) return null

  const url = `${supabaseUrl}/rest/v1/value_timing_index_daily?code=eq.${encodeURIComponent(c)}&select=*&order=data_date.desc&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return null
  const first = j[0]
  if (!first || typeof first !== 'object') return null
  return first as ValueTimingIndexDailyRow
}

export async function readLatestValueTimingIndexSnapshots(codes: string[]): Promise<Map<string, ValueTimingIndexDailyRow>> {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const list = Array.isArray(codes) ? codes.map((x) => String(x || '').trim()).filter(Boolean) : []
  const out = new Map<string, ValueTimingIndexDailyRow>()
  const readKey = anonKey || serviceKey
  if (!supabaseUrl || !readKey || list.length === 0) return out

  const inList = list.map((x) => encodeURIComponent(x)).join(',')
  const url = `${supabaseUrl}/rest/v1/value_timing_index_daily?code=in.(${inList})&select=*&order=code.asc,data_date.desc`
  const res = await fetch(url, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`,
    },
  })
  if (!res.ok) return out
  const j = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(j) || j.length === 0) return out
  for (const row of j) {
    if (!row || typeof row !== 'object') continue
    const r = row as ValueTimingIndexDailyRow
    const c = typeof r.code === 'string' ? r.code : ''
    if (!c || out.has(c)) continue
    out.set(c, r)
  }
  return out
}

export async function upsertValueTimingIndexSnapshot(payload: {
  code: string
  data_date: string
  snapshot_at: string
  source_type?: string | null
  source?: string | null
  notes?: unknown
  payload: unknown
  updated_at?: string
}): Promise<void> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const p = payload && typeof payload === 'object' ? payload : null
  if (!p) throw new Error('bad payload')

  const code = String(p.code || '').trim()
  const dataDate = String(p.data_date || '').trim()
  const snapshotAt = String(p.snapshot_at || '').trim()
  if (!code) throw new Error('missing code')
  if (!dataDate) throw new Error('missing data_date')
  if (!snapshotAt) throw new Error('missing snapshot_at')

  const row = {
    code,
    data_date: dataDate,
    snapshot_at: snapshotAt,
    source_type: p.source_type ?? null,
    source: p.source ?? null,
    notes: p.notes ?? [],
    payload: p.payload,
    updated_at: p.updated_at ? String(p.updated_at) : new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/value_timing_index_daily?on_conflict=code,data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write value_timing_index_daily failed: HTTP ${res.status} ${body}`)
  }
}
