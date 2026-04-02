export type NewsItem = {
  title: string
  link: string
  snippet: string | null
  source: string | null
  date: string | null
  query: string
}

function asStr(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

function uniqByLink(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const x of items) {
    const k = x.link
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

export async function searchNewsBySerpApi(opts: {
  apiKey: string
  queries: string[]
  from?: string | null
  to?: string | null
  maxItems?: number
  signal?: AbortSignal
}) {
  const apiKey = String(opts.apiKey || '').trim()
  if (!apiKey) return { provider: 'serpapi', items: [] as NewsItem[] }

  const queries = (opts.queries || []).map((q) => String(q || '').trim()).filter(Boolean).slice(0, 5)
  if (!queries.length) return { provider: 'serpapi', items: [] as NewsItem[] }

  const from = asStr(opts.from)
  const to = asStr(opts.to)
  const tbs = from && to ? `cdr:1,cd_min:${from},cd_max:${to}` : null
  const maxItems = typeof opts.maxItems === 'number' && opts.maxItems > 0 ? Math.floor(opts.maxItems) : 12

  const requests = queries.map(async (q) => {
    const u = new URL('https://serpapi.com/search.json')
    u.searchParams.set('engine', 'google_news')
    u.searchParams.set('q', q)
    u.searchParams.set('hl', 'zh-cn')
    u.searchParams.set('gl', 'cn')
    u.searchParams.set('num', '10')
    if (tbs) u.searchParams.set('tbs', tbs)
    u.searchParams.set('api_key', apiKey)

    const r = await fetch(u.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: opts.signal,
    })
    if (!r.ok) throw new Error(`SerpAPI 请求失败：HTTP ${r.status}`)
    const j = (await r.json()) as Record<string, unknown>
    const arr = Array.isArray(j.news_results) ? (j.news_results as Array<Record<string, unknown>>) : []
    const mapped: NewsItem[] = arr
      .map((x) => {
        const title = asStr(x.title)
        const link = asStr(x.link)
        if (!title || !link) return null
        return {
          title,
          link,
          snippet: asStr(x.snippet),
          source: asStr(x.source),
          date: asStr(x.date),
          query: q,
        } satisfies NewsItem
      })
      .filter((x): x is NewsItem => Boolean(x))
    return mapped
  })

  const settled = await Promise.allSettled(requests)
  const merged: NewsItem[] = []
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue
    merged.push(...s.value)
  }

  const items = uniqByLink(merged).slice(0, maxItems)
  return {
    provider: 'serpapi',
    items,
  }
}

