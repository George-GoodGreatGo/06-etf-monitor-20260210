export type Riskfree10yProviderName = 'chinamoney' | 'chinabond' | 'eastmoney' | 'worldgovernmentbonds'

export type Riskfree10yRawPoint = {
  date: string
  valuePct: number
  source: Riskfree10yProviderName
  observedAt: string
  sourceDetail?: string
}

export type Riskfree10yProviderResult = {
  source: Riskfree10yProviderName
  points: Map<string, Riskfree10yRawPoint>
  notes: string[]
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0'

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function toNum(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : raw == null ? NaN : Number(String(raw).trim())
  return Number.isFinite(n) ? n : null
}

export function isYmd10(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(raw || '').trim())
}

export function normalizeYmd10(raw: unknown): string {
  const s = String(raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}[ T]/.test(s)) return s.slice(0, 10)
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return ''
}

export function ymd10ToDate(raw: string): Date | null {
  const s = normalizeYmd10(raw)
  if (!s) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

export function addUtcDays(ymd10: string, days: number): string | null {
  const d = ymd10ToDate(ymd10)
  if (!d) return null
  const out = new Date(d.getTime() + days * 86_400_000)
  return out.toISOString().slice(0, 10)
}

export function dateRangeDays(startDate: string, endDate: string): string[] {
  const start = ymd10ToDate(startDate)
  const end = ymd10ToDate(endDate)
  if (!start || !end || start > end) return []
  const out: string[] = []
  for (let ms = start.getTime(); ms <= end.getTime(); ms += 86_400_000) {
    out.push(new Date(ms).toISOString().slice(0, 10))
  }
  return out
}

export function clampPctValue(valuePct: number | null): number | null {
  if (valuePct == null || !Number.isFinite(valuePct)) return null
  if (valuePct < 0 || valuePct > 10) return null
  return valuePct
}

export function createPoint(input: {
  date: string
  valuePct: number
  source: Riskfree10yProviderName
  observedAt?: string
  sourceDetail?: string
}): Riskfree10yRawPoint | null {
  const date = normalizeYmd10(input.date)
  const valuePct = clampPctValue(toNum(input.valuePct))
  if (!date || valuePct == null) return null
  return {
    date,
    valuePct,
    source: input.source,
    observedAt: input.observedAt || new Date().toISOString(),
    sourceDetail: input.sourceDetail,
  }
}

export async function fetchTextWithRetry(input: {
  url: string
  timeoutMs?: number
  maxAttempts?: number
  headers?: Record<string, string>
}): Promise<string> {
  const timeoutMs = Math.max(1_000, Math.floor(input.timeoutMs ?? 8_000))
  const maxAttempts = Math.max(1, Math.min(5, Math.floor(input.maxAttempts ?? 2)))
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const ac = new AbortController()
    const id = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(input.url, {
        signal: ac.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'application/json,text/plain,text/html,*/*',
          ...input.headers,
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`)
      }
      return await res.text()
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < maxAttempts) await sleep(200 * attempt)
    } finally {
      clearTimeout(id)
    }
  }
  throw lastErr || new Error('fetch text failed')
}

export async function fetchJsonWithRetry<T>(input: {
  url: string
  timeoutMs?: number
  maxAttempts?: number
  headers?: Record<string, string>
}): Promise<T> {
  const text = await fetchTextWithRetry(input)
  return JSON.parse(text) as T
}

export async function fetchPostJsonWithRetry<T>(input: {
  url: string
  body: unknown
  timeoutMs?: number
  maxAttempts?: number
  headers?: Record<string, string>
}): Promise<T> {
  const timeoutMs = Math.max(1_000, Math.floor(input.timeoutMs ?? 8_000))
  const maxAttempts = Math.max(1, Math.min(5, Math.floor(input.maxAttempts ?? 2)))
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const ac = new AbortController()
    const id = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(input.url, {
        method: 'POST',
        signal: ac.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'application/json,text/plain,text/html,*/*',
          'Content-Type': 'application/json',
          ...input.headers,
        },
        body: JSON.stringify(input.body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`)
      }
      return (await res.json()) as T
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < maxAttempts) await sleep(200 * attempt)
    } finally {
      clearTimeout(id)
    }
  }
  throw lastErr || new Error('fetch post json failed')
}

export async function fetchBufferWithRetry(input: {
  url: string
  timeoutMs?: number
  maxAttempts?: number
  headers?: Record<string, string>
}): Promise<Buffer> {
  const timeoutMs = Math.max(1_000, Math.floor(input.timeoutMs ?? 12_000))
  const maxAttempts = Math.max(1, Math.min(5, Math.floor(input.maxAttempts ?? 2)))
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const ac = new AbortController()
    const id = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(input.url, {
        signal: ac.signal,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'application/octet-stream,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
          ...input.headers,
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ` ${text.slice(0, 240)}` : ''}`)
      }
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < maxAttempts) await sleep(300 * attempt)
    } finally {
      clearTimeout(id)
    }
  }
  throw lastErr || new Error('fetch buffer failed')
}

export function mergePointMaps(...maps: Array<Map<string, Riskfree10yRawPoint>>): Map<string, Riskfree10yRawPoint> {
  const out = new Map<string, Riskfree10yRawPoint>()
  for (const m of maps) {
    for (const [date, point] of m.entries()) out.set(date, point)
  }
  return out
}
