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

