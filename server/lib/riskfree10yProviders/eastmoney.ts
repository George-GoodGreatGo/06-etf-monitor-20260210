import {
  createPoint,
  fetchJsonWithRetry,
  normalizeYmd10,
  type Riskfree10yProviderResult,
  type Riskfree10yRawPoint,
} from './shared.js'

type EastmoneyResp = {
  success?: boolean
  result?: {
    data?: Array<Record<string, unknown>>
  }
}

const cache = new Map<string, { expiresAt: number; value: Map<string, Riskfree10yRawPoint> }>()
const inflight = new Map<string, Promise<{ points: Map<string, Riskfree10yRawPoint>; note?: string }>>()

function isEastmoneyPlaceholderValue(valuePct: number): boolean {
  return !Number.isFinite(valuePct) || valuePct === 0
}

export async function fetchEastmoney10yRange(input: {
  startDate: string
  endDate: string
}): Promise<Riskfree10yProviderResult> {
  const cacheKey = `${input.startDate}:${input.endDate}`
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) {
    const note = (hit as { expiresAt: number; value: Map<string, Riskfree10yRawPoint>; placeholderNote?: string }).placeholderNote
    return { source: 'eastmoney', points: hit.value, notes: ['source=eastmoney', 'report=RPTA_WEB_TREASURYYIELD', ...(note ? [note] : [])] }
  }
  const existing = inflight.get(cacheKey)
  if (existing) {
    const current = await existing
    return { source: 'eastmoney', points: current.points, notes: ['source=eastmoney', 'report=RPTA_WEB_TREASURYYIELD', ...(current.note ? [current.note] : [])] }
  }

  const task = (async () => {
    const json = await fetchJsonWithRetry<EastmoneyResp>({
      url:
        'https://datacenter-web.eastmoney.com/api/data/v1/get' +
        '?reportName=RPTA_WEB_TREASURYYIELD' +
        '&columns=ALL' +
        '&sortColumns=SOLAR_DATE' +
        '&sortTypes=-1' +
        '&token=894050c76af8597a853f5b408b759f5d' +
        '&pageNumber=1' +
        '&pageSize=10000',
      timeoutMs: 8_000,
      maxAttempts: 2,
      headers: {
        Referer: 'https://data.eastmoney.com/cjsj/zmgzsyl.html',
      },
    })
    if (json?.success !== true) throw new Error('eastmoney treasury yield query failed')
    const rows = Array.isArray(json?.result?.data) ? json.result.data : []
    const out = new Map<string, Riskfree10yRawPoint>()
    const filteredPlaceholderDates: string[] = []
    for (const row of rows) {
      const date = normalizeYmd10(row.SOLAR_DATE)
      if (!date || date < input.startDate || date > input.endDate) continue
      const valuePct = Number(row.EMM00166466)
      if (isEastmoneyPlaceholderValue(valuePct)) {
        filteredPlaceholderDates.push(date)
        continue
      }
      const point = createPoint({
        date,
        valuePct,
        source: 'eastmoney',
        sourceDetail: 'RPTA_WEB_TREASURYYIELD:EMM00166466',
      })
      if (point) out.set(point.date, point)
    }
    if (filteredPlaceholderDates.length) {
      const sample = filteredPlaceholderDates.slice(0, 8).join(',')
      const suffix = filteredPlaceholderDates.length > 8 ? `+${filteredPlaceholderDates.length - 8}` : ''
      const note = `filtered_placeholder_zero=${sample}${suffix}`
      cache.set(cacheKey, {
        expiresAt: Date.now() + 12 * 60 * 60_000,
        value: out,
        placeholderNote: note,
      } as { expiresAt: number; value: Map<string, Riskfree10yRawPoint>; placeholderNote?: string })
      return { points: out, note }
    }
    cache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60_000, value: out })
    return { points: out }
  })().finally(() => inflight.delete(cacheKey))

  inflight.set(cacheKey, task)
  const current = await task
  return {
    source: 'eastmoney',
    points: current.points,
    notes: ['source=eastmoney', 'report=RPTA_WEB_TREASURYYIELD', 'field=EMM00166466', ...(current.note ? [current.note] : [])],
  }
}
