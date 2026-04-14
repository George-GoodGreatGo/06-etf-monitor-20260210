import * as XLSX from 'xlsx'

const YC_DEF_ID_GOV_BOND_MATURITY = '2c9081e50a2f9606010a3068cae70001'

type CacheEntry = { expiresAt: number; value: Map<string, number> }
const cache = new Map<number, CacheEntry>()
const inflight = new Map<number, Promise<Map<string, number>>>()

function toYmd10FromExcelDate(n: number): string | null {
  const v = XLSX.SSF.parse_date_code(n)
  if (!v) return null
  const y = String(v.y).padStart(4, '0')
  const m = String(v.m).padStart(2, '0')
  const d = String(v.d).padStart(2, '0')
  if (!y || !m || !d) return null
  return `${y}-${m}-${d}`
}

function normalizeYmd10(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return toYmd10FromExcelDate(raw)
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return null
}

function toNum(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : raw == null ? NaN : Number(String(raw).trim())
  return Number.isFinite(n) ? n : null
}

function findHeaderRow(rows: unknown[][]): { rowIdx: number; dateCol: number; termCol: number; yieldCol: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i] || []
    let dateCol = -1
    let termCol = -1
    let yieldCol = -1
    for (let c = 0; c < row.length; c += 1) {
      const s = typeof row[c] === 'string' ? String(row[c]).replace(/\s+/g, '') : ''
      if (dateCol < 0 && s === '日期') dateCol = c
      if (termCol < 0 && (s === '标准期限(年)' || s === '标准期限（年）')) termCol = c
      if (yieldCol < 0 && (s === '收益率(%)' || s === '收益率（%）')) yieldCol = c
    }
    if (dateCol >= 0 && termCol >= 0 && yieldCol >= 0) return { rowIdx: i, dateCol, termCol, yieldCol }
  }
  return null
}

async function fetchYearXlsx(year: number): Promise<Buffer> {
  const url =
    `https://yield.chinabond.com.cn/cbweb-mn/yc/downYearBzqx?year=${year}` +
    `&wrjxCBFlag=0&zblx=txy&ycDefId=${YC_DEF_ID_GOV_BOND_MATURITY}&locale=zh_CN`
  
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`chinamoney downYearBzqx failed: HTTP ${res.status} ${text}`)
      }
      const arrayBuf = await res.arrayBuffer()
      if (arrayBuf.byteLength < 1000) {
        // Sometimes they return a short error HTML string instead of a 50x code
        const text = Buffer.from(arrayBuf).toString('utf-8')
        if (text.includes('<html') || text.includes('504')) {
          throw new Error(`chinamoney downYearBzqx failed: Returned short HTML error instead of Excel file`)
        }
      }
      return Buffer.from(arrayBuf)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000 * attempt)) // Wait before retry
      }
    }
  }
  throw lastErr
}

export async function fetchGovBond10yYieldPctByDate(input: {
  year: number
  cacheTtlMs?: number
}): Promise<Map<string, number>> {
  const year = input.year
  const ttl = input.cacheTtlMs ?? 12 * 60 * 60_000
  const now = Date.now()

  const hit = cache.get(year)
  if (hit && hit.expiresAt > now) return hit.value

  const existing = inflight.get(year)
  if (existing) return await existing

  const p = (async () => {
    const buf = await fetchYearXlsx(year)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    const ws = sheetName ? wb.Sheets[sheetName] : null
    if (!ws) throw new Error('chinamoney xlsx missing sheet')
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][]
    const hdr = findHeaderRow(rows)
    if (!hdr) throw new Error('chinamoney xlsx header not found')

    const out = new Map<string, number>()
    for (let i = hdr.rowIdx + 1; i < rows.length; i += 1) {
      const row = rows[i] || []
      const date = normalizeYmd10(row[hdr.dateCol])
      const term = toNum(row[hdr.termCol])
      const y = toNum(row[hdr.yieldCol])
      if (!date || term == null || y == null) continue
      if (term === 10) out.set(date, y)
    }
    cache.set(year, { expiresAt: now + ttl, value: out })
    return out
  })().finally(() => inflight.delete(year))

  inflight.set(year, p)
  return await p
}
