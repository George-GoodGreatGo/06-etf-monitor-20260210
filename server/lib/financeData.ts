type FinanceDataResponse = {
  data?: {
    fields?: string[]
    items?: unknown[][]
  }
}

type CacheEntry = {
  expiresAt: number
  value: Record<string, unknown>[]
}

const responseCache = new Map<string, CacheEntry>()
let queueTail: Promise<void> = Promise.resolve()
let nextAllowedAt = 0

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function buildCacheKey(input: { apiName: string; params: Record<string, unknown>; fields: string }) {
  return JSON.stringify({
    apiName: input.apiName,
    params: input.params || {},
    fields: input.fields,
  })
}

async function enqueueWithGap<T>(fn: () => Promise<T>) {
  let release: (() => void) | null = null
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const prev = queueTail
  queueTail = gate
  await prev
  try {
    const now = Date.now()
    const waitMs = Math.max(0, nextAllowedAt - now)
    if (waitMs > 0) await sleep(waitMs)
    const out = await fn()
    nextAllowedAt = Date.now() + 450
    return out
  } finally {
    release?.()
  }
}

function extractWafUuid(text: string): string | null {
  const m = text.match(/请求UUID[：:\s]*<\/?span[^>]*>\s*<span[^>]*id=["']uuid["'][^>]*>([^<]+)</i) || text.match(/请求UUID[：:\s]*([a-zA-Z0-9-]{16,})/i)
  return m && m[1] ? String(m[1]).trim() : null
}

export async function fetchFinanceData(input: {
  apiName: string
  params: Record<string, unknown>
  fields: string
}): Promise<Record<string, unknown>[]> {
  const apiName = String(input.apiName || '').trim()
  const fields = String(input.fields || '').trim()
  if (!apiName || !fields) return []

  const cacheKey = buildCacheKey({ apiName, params: input.params || {}, fields })
  const hit = responseCache.get(cacheKey)
  const now = Date.now()
  if (hit && hit.expiresAt > now) return hit.value

  const url = 'https://www.codebuddy.cn/v2/tool/financedata'
  const out = await enqueueWithGap(async () => {
    const ac = new AbortController()
    const timer = setTimeout(() => {
      try {
        ac.abort()
      } catch {
        void 0
      }
    }, 20_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Origin: 'https://www.codebuddy.cn',
          Referer: 'https://www.codebuddy.cn/',
        },
        body: JSON.stringify({
          api_name: apiName,
          params: input.params || {},
          fields,
        }),
        signal: ac.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        if (res.status === 403) {
          const uuid = extractWafUuid(text)
          const suffix = uuid ? ` WAF_UUID=${uuid}` : ''
          throw new Error(`financedata failed: HTTP 403${suffix}`)
        }
        throw new Error(`financedata failed: HTTP ${res.status} ${text}`)
      }

      const j = (await res.json().catch(() => null)) as (FinanceDataResponse & { code?: number; msg?: string }) | null
      if (j && typeof j === 'object' && 'code' in j && j.code !== 0) {
        throw new Error(`financedata API error: ${j.msg || 'unknown error'}`)
      }

      const data = j && typeof j === 'object' ? j.data : null
      const respFields = Array.isArray(data?.fields) ? data?.fields : null
      const respItems = Array.isArray(data?.items) ? data?.items : null
      if (!respFields || !respItems) return []

      const rows: Record<string, unknown>[] = []
      for (const row of respItems) {
        if (!Array.isArray(row)) continue
        const o: Record<string, unknown> = {}
        for (let i = 0; i < respFields.length; i += 1) {
          const k = respFields[i]
          if (typeof k !== 'string' || !k) continue
          o[k] = row[i]
        }
        rows.push(o)
      }
      return rows
    } finally {
      clearTimeout(timer)
    }
  })

  responseCache.set(cacheKey, { expiresAt: Date.now() + 60_000, value: out })
  return out
}
