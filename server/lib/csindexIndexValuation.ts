import xlsx from 'xlsx'

type CacheEntry = { expiresAt: number; value: Array<{ date: string; pe: number | null; dividendYieldPct: number | null }> }
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

function ymd8ToDash(ymd8: string): string {
  return `${ymd8.slice(0, 4)}-${ymd8.slice(4, 6)}-${ymd8.slice(6, 8)}`
}

function toNum(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function buildUrl(indexCode: string): string {
  const code = String(indexCode || '').trim()
  return `https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/indicator/${encodeURIComponent(code)}indicator.xls`
}

async function fetchOnce(indexCode: string): Promise<Array<{ date: string; pe: number | null; dividendYieldPct: number | null }>> {
  const url = buildUrl(indexCode)
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: '*/*',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`csindex indicator xls failed: HTTP ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const wb = xlsx.read(buf, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined
  if (!sheet) return []

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[]
  const out: Array<{ date: string; pe: number | null; dividendYieldPct: number | null }> = []
  for (const r of rows) {
    if (!Array.isArray(r)) continue
    const ymd8 = normalizeYmd8(r[0])
    if (!ymd8) continue
    const pe2 = toNum(r[7])
    const dy2 = toNum(r[9])
    out.push({
      date: ymd8ToDash(ymd8),
      pe: pe2,
      dividendYieldPct: dy2,
    })
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

export async function fetchCsindexIndexValuationSeries(args: {
  indexCode: string
  cacheTtlMs?: number
}): Promise<Array<{ date: string; pe: number | null; dividendYieldPct: number | null }>> {
  const indexCode = String(args.indexCode || '').trim()
  if (!indexCode) return []

  const key = `csindex:indicator-xls:${indexCode}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  let lastErr: unknown = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const value = await fetchOnce(indexCode)
      const ttl = typeof args.cacheTtlMs === 'number' && Number.isFinite(args.cacheTtlMs) ? args.cacheTtlMs : 6 * 60 * 60_000
      cache.set(key, { expiresAt: Date.now() + Math.max(10_000, ttl), value })
      return value
    } catch (e) {
      lastErr = e
      if (i === 0) await sleep(250)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

