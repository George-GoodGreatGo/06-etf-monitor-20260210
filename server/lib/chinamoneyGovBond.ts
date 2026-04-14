import * as XLSX from 'xlsx'

const YC_DEF_ID_GOV_BOND_MATURITY = '2c9081e50a2f9606010a3068cae70001'

type CacheEntry = { expiresAt: number; value: Map<string, number> }
const cache = new Map<number, CacheEntry>()
const inflight = new Map<number, Promise<Map<string, number>>>()

function shouldVerboseLog(): boolean {
  const v = String(process.env.CHINAMONEY_VERBOSE || '').trim()
  if (v === '1' || v.toLowerCase() === 'true') return true
  return String(process.env.GITHUB_ACTIONS || '').trim().toLowerCase() === 'true'
}

function logEvent(event: Record<string, unknown>) {
  if (!shouldVerboseLog()) return
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ms = Math.max(1_000, Math.min(60_000, Math.floor(timeoutMs)))
  const ac = new AbortController()
  const id = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      },
    })
  } finally {
    clearTimeout(id)
  }
}

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
  const maxAttemptsRaw = Number(process.env.CHINAMONEY_FETCH_MAX_ATTEMPTS)
  const maxAttempts = Number.isFinite(maxAttemptsRaw) ? Math.max(1, Math.min(8, Math.floor(maxAttemptsRaw))) : 5
  const baseDelayRaw = Number(process.env.CHINAMONEY_FETCH_BASE_DELAY_MS)
  const baseDelayMs = Number.isFinite(baseDelayRaw) ? Math.max(0, Math.min(30_000, Math.floor(baseDelayRaw))) : 1_500
  const startedAt = Date.now()
  logEvent({ event: 'chinamoney.10y.year.start', year, maxAttempts, baseDelayMs })
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const timeoutMs = 20_000 + attempt * 5_000
      const res = await fetchWithTimeout(url, timeoutMs)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`chinamoney downYearBzqx failed: HTTP ${res.status} ${text}`)
      }
      const ct = String(res.headers.get('content-type') || '')
      const arrayBuf = await res.arrayBuffer()
      if (ct.includes('text/html') || arrayBuf.byteLength < 2_048) {
        const text = Buffer.from(arrayBuf).toString('utf-8')
        const hint = text.slice(0, 400)
        if (ct.includes('text/html') || hint.toLowerCase().includes('<html') || hint.includes('Gateway Time-out') || hint.includes('504')) {
          throw new Error(`chinamoney downYearBzqx failed: unexpected html body ${hint}`)
        }
      }
      logEvent({ event: 'chinamoney.10y.year.done', year, attempt, timeoutMs, bytes: arrayBuf.byteLength, ms: Date.now() - startedAt })
      return Buffer.from(arrayBuf)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < maxAttempts) {
        const base = Math.min(30_000, baseDelayMs * 2 ** (attempt - 1))
        const jitter = Math.floor(Math.random() * 350)
        const waitMs = base + jitter
        logEvent({
          event: 'chinamoney.10y.year.retry',
          year,
          attempt,
          timeoutMs: 20_000 + attempt * 5_000,
          waitMs,
          error: String(lastErr.message || '').slice(0, 220),
        })
        await sleep(waitMs)
      } else {
        logEvent({
          event: 'chinamoney.10y.year.fail',
          year,
          attempt,
          timeoutMs: 20_000 + attempt * 5_000,
          ms: Date.now() - startedAt,
          error: String(lastErr.message || '').slice(0, 320),
        })
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
    logEvent({ event: 'chinamoney.10y.year.parsed', year, points: out.size })
    cache.set(year, { expiresAt: now + ttl, value: out })
    return out
  })().finally(() => inflight.delete(year))

  inflight.set(year, p)
  return await p
}

export async function fetchGovBond10yYieldPctByDateSafe(input: {
  year: number
  cacheTtlMs?: number
}): Promise<{ map: Map<string, number>; error: string | null }> {
  try {
    const map = await fetchGovBond10yYieldPctByDate(input)
    return { map, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { map: new Map<string, number>(), error: msg || 'unknown_error' }
  }
}
