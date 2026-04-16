import xlsx from 'xlsx'

type CacheEntry = { expiresAt: number; value: Array<{ date: string; pe: number | null; dividendYieldPct: number | null }> }
const cache = new Map<string, CacheEntry>()

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function excelSerialToYmd8(raw: number): string {
  const ssf = (xlsx as unknown as { SSF?: { parse_date_code?: (n: number) => unknown } }).SSF
  const parsed = ssf?.parse_date_code ? ssf.parse_date_code(raw) : null
  const rec = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  const y = rec && Number.isFinite(rec.y) ? Number(rec.y) : NaN
  const m = rec && Number.isFinite(rec.m) ? Number(rec.m) : NaN
  const d = rec && Number.isFinite(rec.d) ? Number(rec.d) : NaN
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  if (y < 1900 || y > 2100) return ''
  return `${String(y).padStart(4, '0')}${pad2(m)}${pad2(d)}`
}

function normalizeYmd8(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 10_000) {
    const ymd8 = excelSerialToYmd8(raw)
    if (ymd8) return ymd8
  }
  const s = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim()
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

function findHeaderRow(rows: unknown[]): { rowIdx: number; dateCol: number; peCol: number; dyCol: number } | null {
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const cells = r.map((x) => (typeof x === 'string' ? x.trim() : x == null ? '' : String(x).trim()))
    const dateCol = cells.findIndex((x) => x.includes('日期'))
    const peCol = cells.findIndex((x) => x.includes('市盈率') || x.toLowerCase() === 'pe' || x.toLowerCase().includes('p/e'))
    const dyCol = cells.findIndex((x) => x.includes('股息率'))
    if (dateCol >= 0 && peCol >= 0) return { rowIdx: i, dateCol, peCol, dyCol: dyCol >= 0 ? dyCol : -1 }
  }
  return null
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
  const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames : []
  const out: Array<{ date: string; pe: number | null; dividendYieldPct: number | null }> = []
  for (const sheetName of sheetNames) {
    const sheet = sheetName ? wb.Sheets[sheetName] : undefined
    if (!sheet) continue
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[]
    const hdr = findHeaderRow(rows)
    if (!hdr) continue
    for (let i = hdr.rowIdx + 1; i < rows.length; i += 1) {
      const r = rows[i]
      if (!Array.isArray(r)) continue
      const ymd8 = normalizeYmd8(r[hdr.dateCol])
      if (!ymd8) continue
      const pe2 = toNum(r[hdr.peCol])
      const dy2 = hdr.dyCol >= 0 ? toNum(r[hdr.dyCol]) : null
      out.push({ date: ymd8ToDash(ymd8), pe: pe2, dividendYieldPct: dy2 })
    }
    if (out.length) break
  }
  if (!out.length && sheetNames.length) {
    const sheet = wb.Sheets[sheetNames[0]]
    const rows = sheet ? (xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[]) : []
    for (const r of rows) {
      if (!Array.isArray(r)) continue
      const ymd8 = normalizeYmd8(r[0])
      if (!ymd8) continue
      const pe2 = toNum(r[7])
      const dy2 = toNum(r[9])
      out.push({ date: ymd8ToDash(ymd8), pe: pe2, dividendYieldPct: dy2 })
    }
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
