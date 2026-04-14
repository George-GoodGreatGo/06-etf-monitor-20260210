type CsindexPeRow = {
  tradeDate?: string
  peg?: number
}

type CsindexPeResponse = {
  code?: number
  msg?: string
  success?: boolean
  data?: CsindexPeRow[]
}

type CacheEntry = { expiresAt: number; value: Record<string, unknown>[] }
const cache = new Map<string, CacheEntry>()

function buildKey(indexCode: string, startDate: string, endDate: string) {
  return `csindex:pe:${indexCode}:${startDate}:${endDate}`
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function normalizeYmd8(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (/^\d{8}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '')
  return ''
}

function toNum(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

async function fetchOnce(url: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`csindex failed: HTTP ${res.status} ${text}`)
  }

  const j = (await res.json().catch(() => null)) as CsindexPeResponse | null
  if (!j || typeof j !== 'object') return []
  if (typeof j.code === 'number' && j.code !== 200) throw new Error(`csindex API error: ${j.msg || 'unknown error'}`)
  const rows = Array.isArray(j.data) ? j.data : []

  const out: Record<string, unknown>[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const ymd = normalizeYmd8((r as CsindexPeRow).tradeDate)
    if (!ymd) continue
    out.push({ trade_date: ymd, pe: toNum((r as CsindexPeRow).peg) })
  }
  return out
}

export async function fetchCsindexHs300PeSeries(args: { startDate: string; endDate: string }): Promise<Record<string, unknown>[]> {
  const startDate = normalizeYmd8(args.startDate)
  const endDate = normalizeYmd8(args.endDate)
  if (!startDate || !endDate) return []

  const indexCode = '000300'
  const key = buildKey(indexCode, startDate, endDate)
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const url = new URL('https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe')
  url.searchParams.set('indexCode', indexCode)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)

  let lastErr: unknown = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const value = await fetchOnce(url.toString())
      cache.set(key, { expiresAt: now + 10 * 60_000, value })
      return value
    } catch (e) {
      lastErr = e
      if (i === 0) await sleep(250)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export async function fetchCsindexIndexPeSeries(args: {
  indexCode: string
  startDate: string
  endDate: string
}): Promise<Record<string, unknown>[]> {
  const indexCode = String(args.indexCode || '').trim()
  const startDate = normalizeYmd8(args.startDate)
  const endDate = normalizeYmd8(args.endDate)
  if (!indexCode || !startDate || !endDate) return []

  const key = buildKey(indexCode, startDate, endDate)
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const url = new URL('https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe')
  url.searchParams.set('indexCode', indexCode)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)

  let lastErr: unknown = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const value = await fetchOnce(url.toString())
      cache.set(key, { expiresAt: now + 10 * 60_000, value })
      return value
    } catch (e) {
      lastErr = e
      if (i === 0) await sleep(250)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

