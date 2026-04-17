import {
  createPoint,
  fetchJsonWithRetry,
  normalizeYmd10,
  type Riskfree10yProviderResult,
  type Riskfree10yRawPoint,
} from './shared.js'

type ChinamoneyLatestResp = {
  data?: {
    showDateCN?: unknown
    bond10Y?: unknown
  }
}

const latestCache = new Map<string, { expiresAt: number; value: Map<string, Riskfree10yRawPoint> }>()

async function fetchLatest(): Promise<Map<string, Riskfree10yRawPoint>> {
  const cacheKey = 'latest'
  const hit = latestCache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const json = await fetchJsonWithRetry<ChinamoneyLatestResp>({
    url: 'https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/sdds-intr-rate.json',
    timeoutMs: 5_000,
    maxAttempts: 2,
  })
  const out = new Map<string, Riskfree10yRawPoint>()
  const date = normalizeYmd10(json?.data?.showDateCN)
  const point = createPoint({
    date,
    valuePct: Number(json?.data?.bond10Y),
    source: 'chinamoney',
    sourceDetail: 'latest-json',
  })
  if (point) out.set(point.date, point)
  latestCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, value: out })
  return out
}

export async function fetchChinamoney10yRange(input: {
  startDate: string
  endDate: string
}): Promise<Riskfree10yProviderResult> {
  const latestAll = await fetchLatest()
  const latest = new Map<string, Riskfree10yRawPoint>()
  for (const [date, point] of latestAll.entries()) {
    if (date >= input.startDate && date <= input.endDate) latest.set(date, point)
  }
  return {
    source: 'chinamoney',
    points: latest,
    notes: ['source=chinamoney', 'latest=json', 'mode=latest-only'],
  }
}
