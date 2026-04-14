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

async function fetchPage(url: URL): Promise<{ rows: Record<string, unknown>[]; pages: number }> {
  const res = await fetch(url.toString(), {
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
  if (!j || typeof j !== 'object') return { rows: [], pages: 0 }
  if (j.success !== true) {
    const msg = typeof j.message === 'string' ? j.message : 'unknown error'
    if (msg.includes('返回数据为空')) return { rows: [], pages: 0 }
    throw new Error(`northbound API error: ${msg}`)
  }
  const rows = Array.isArray(j.result?.data) ? j.result?.data : []
  const pagesRaw = typeof j.result?.pages === 'number' ? j.result?.pages : j.result?.pages == null ? NaN : Number(j.result?.pages)
  const pages = Number.isFinite(pagesRaw) && pagesRaw > 0 ? Math.floor(pagesRaw) : 0

  const out: Record<string, unknown>[] = []
  for (const r of rows) {
    const dRaw = r && typeof r === 'object' ? (r as Record<string, unknown>).TRADE_DATE : null
    const dStr = typeof dRaw === 'string' ? dRaw.slice(0, 10) : ''
    const ymd8 = normalizeYmd8(dStr)
    if (!ymd8) continue
    const vRaw = toNum((r as Record<string, unknown>).DEAL_AMT)
    const v = vRaw == null ? null : vRaw / 100
    out.push({ trade_date: ymd8, north_money: v })
  }
  return { rows: out, pages }
}

export async function fetchNorthboundTotalTurnoverSeries(args: {
  startDate: string
  endDate: string
}): Promise<Record<string, unknown>[]> {
  const startDate = normalizeYmd8(args.startDate)
  const endDate = normalizeYmd8(args.endDate)
  if (!startDate || !endDate) return []

  const key = `northbound:deal_amt_total:${startDate}:${endDate}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const start10 = ymd8ToYmd10(startDate)
  const end10 = ymd8ToYmd10(endDate)
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get')
  url.searchParams.set('reportName', 'RPT_MUTUAL_DEAL_HISTORY')
  url.searchParams.set('columns', 'TRADE_DATE,MUTUAL_TYPE,DEAL_AMT')
  url.searchParams.set('pageNumber', '1')
  url.searchParams.set('pageSize', '600')
  url.searchParams.set('sortTypes', '1')
  url.searchParams.set('sortColumns', 'TRADE_DATE')
  url.searchParams.set('source', 'WEB')
  url.searchParams.set('client', 'WEB')
  url.searchParams.set('filter', `(MUTUAL_TYPE="005")(TRADE_DATE>='${start10}')(TRADE_DATE<='${end10}')`)

  let lastErr: unknown = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const map = new Map<string, Record<string, unknown>>()
      const pageSize = 600
      let pages = 0
      for (let page = 1; page <= 50; page += 1) {
        url.searchParams.set('pageNumber', String(page))
        url.searchParams.set('pageSize', String(pageSize))
        const r = await fetchPage(url)
        if (pages === 0) pages = r.pages
        for (const row of r.rows) {
          const d = typeof row.trade_date === 'string' ? row.trade_date : ''
          if (!d) continue
          map.set(d, row)
        }
        if (pages > 0 && page >= pages) break
        if (pages === 0 && r.rows.length < pageSize) break
        if (r.rows.length === 0) break
        if (page === 1) await sleep(120)
      }
      const rows = Array.from(map.values()).sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)))
      cache.set(key, { expiresAt: now + 3 * 60_000, value: rows })
      return rows
    } catch (e) {
      lastErr = e
      if (i === 0) await sleep(250)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

