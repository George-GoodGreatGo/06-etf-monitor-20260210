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
}): Promise<Top100InsightStatusRow | null> {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  const p = payload && typeof payload === 'object' ? payload : null
  if (!p) throw new Error('bad payload')

  const dataDate = String(p.data_date || '').trim()
  if (!dataDate) throw new Error('missing data_date')
  const status = String(p.status || '').trim()
  if (!status) throw new Error('missing status')

  const row = {
    data_date: dataDate,
    status,
    last_error: p.last_error == null ? null : String(p.last_error),
    started_at: p.started_at == null ? null : String(p.started_at),
    finished_at: p.finished_at == null ? null : String(p.finished_at),
    updated_at: p.updated_at ? String(p.updated_at) : new Date().toISOString(),
  }

  const url = `${supabaseUrl}/rest/v1/top100_insight_status?on_conflict=data_date`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
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
  return first as Top100InsightStatusRow
}
