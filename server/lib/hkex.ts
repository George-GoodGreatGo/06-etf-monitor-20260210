type EastmoneyDcResponse = {
  success?: boolean
  code?: number
  message?: string
  result?: {
    pages?: number
    data?: Record<string, unknown>[]
  }
}

type CacheEntry = { expiresAt: number; value: Record<string, unknown>[] }
const cache = new Map<string, CacheEntry>()

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function normalizeYmd8(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (/^\d{8}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '')
  return ''
}

function ymd8ToYmd10(ymd8: string): string {
  return `${ymd8.slice(0, 4)}-${ymd8.slice(4, 6)}-${ymd8.slice(6, 8)}`
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
    throw new Error(`northbound failed: HTTP ${res.status} ${text}`)
  }

  const j = (await res.json().catch(() => null)) as EastmoneyDcResponse | null
  if (!j || typeof j !== 'object') return []
  if (j.success !== true) throw new Error(`northbound API error: ${j.message || 'unknown error'}`)
  const rows = Array.isArray(j.result?.data) ? j.result?.data : []

  const out: Record<string, unknown>[] = []
  for (const r of rows) {
    const dRaw = r && typeof r === 'object' ? (r as Record<string, unknown>).TRADE_DATE : null
    const dStr = typeof dRaw === 'string' ? dRaw.slice(0, 10) : ''
    const ymd8 = normalizeYmd8(dStr)
    if (!ymd8) continue
    const v = toNum((r as Record<string, unknown>).NF_DEAL_AMT)
    out.push({ trade_date: ymd8, north_money: v })
  }
  return out
}

export async function fetchNorthboundNetInflowSeries(args: { startDate: string; endDate: string }): Promise<Record<string, unknown>[]> {
  const startDate = normalizeYmd8(args.startDate)
  const endDate = normalizeYmd8(args.endDate)
  if (!startDate || !endDate) return []

  const key = `northbound:nf_deal_amt:${startDate}:${endDate}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const start10 = ymd8ToYmd10(startDate)
  const url = new URL('https://datacenter-web.eastmoney.com/web/api/data/v1/get')
  url.searchParams.set('reportName', 'RPT_MUTUAL_DEALAMT')
  url.searchParams.set('columns', 'ALL')
  url.searchParams.set('pageNumber', '1')
  url.searchParams.set('pageSize', '600')
  url.searchParams.set('sortTypes', '1')
  url.searchParams.set('sortColumns', 'TRADE_DATE')
  url.searchParams.set('source', 'WEB')
  url.searchParams.set('client', 'WEB')
  url.searchParams.set('filter', `(TRADE_DATE>='${start10}')`)

  let lastErr: unknown = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const rows = await fetchOnce(url.toString())
      const filtered = rows.filter((r) => {
        const d = normalizeYmd8((r as Record<string, unknown>).trade_date)
        return d >= startDate && d <= endDate
      })
      cache.set(key, { expiresAt: now + 3 * 60_000, value: filtered })
      return filtered
    } catch (e) {
      lastErr = e
      if (i === 0) await sleep(250)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

