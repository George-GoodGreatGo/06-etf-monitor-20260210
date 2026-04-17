import {
  createPoint,
  fetchPostJsonWithRetry,
  normalizeYmd10,
  type Riskfree10yProviderResult,
  type Riskfree10yRawPoint,
} from './shared.js'

type WgbQuoteItem = {
  CLOSE_VAL?: unknown
  DATA_VAL?: unknown
  TIME_VAL?: unknown
}

type WgbResp = {
  result?: {
    quote?: Record<string, WgbQuoteItem>
  }
}

const cache = new Map<string, { expiresAt: number; value: Map<string, Riskfree10yRawPoint> }>()
const inflight = new Map<string, Promise<Map<string, Riskfree10yRawPoint>>>()

function buildRequestBody(dateRef: string) {
  return {
    GLOBALVAR: {
      JS_VARIABLE: 'jsGlobalVars',
      FUNCTION: 'Bond',
      DOMESTIC: true,
      ENDPOINT: 'https://www.worldgovernmentbonds.com/wp-json/common/v1/historical',
      DATE_RIF: dateRef,
      OBJ: {
        UNIT: '%',
        DECIMAL: 3,
        UNIT_DELTA: 'bp',
        DECIMAL_DELTA: 1,
      },
      COUNTRY1: {
        SYMBOL: '9',
        PAESE: 'China',
        PAESE_UPPERCASE: 'CHINA',
        BANDIERA: 'cn',
        URL_PAGE: 'china',
      },
      COUNTRY2: null,
      OBJ1: {
        DURATA_STRING: '10 Years',
        DURATA: 120,
      },
      OBJ2: null,
    },
  }
}

export async function fetchWorldGovernmentBonds10yRange(input: {
  startDate: string
  endDate: string
}): Promise<Riskfree10yProviderResult> {
  const cacheKey = `${input.startDate}:${input.endDate}`
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) {
    return {
      source: 'worldgovernmentbonds',
      points: hit.value,
      notes: ['source=worldgovernmentbonds', 'history=wp-json/common/v1/historical'],
    }
  }
  const existing = inflight.get(cacheKey)
  if (existing) {
    const points = await existing
    return {
      source: 'worldgovernmentbonds',
      points,
      notes: ['source=worldgovernmentbonds', 'history=wp-json/common/v1/historical'],
    }
  }

  const task = (async () => {
    const json = await fetchPostJsonWithRetry<WgbResp>({
      url: 'https://www.worldgovernmentbonds.com/wp-json/common/v1/historical',
      body: buildRequestBody(input.endDate),
      timeoutMs: 10_000,
      maxAttempts: 2,
      headers: {
        Origin: 'https://www.worldgovernmentbonds.com',
        Referer: 'https://www.worldgovernmentbonds.com/bond-historical-data/china/10-years/',
      },
    })
    const rows = json?.result?.quote && typeof json.result.quote === 'object' ? Object.values(json.result.quote) : []
    const out = new Map<string, Riskfree10yRawPoint>()
    for (const row of rows) {
      const date = normalizeYmd10(row?.DATA_VAL)
      if (!date || date < input.startDate || date > input.endDate) continue
      const point = createPoint({
        date,
        valuePct: Number(row?.CLOSE_VAL),
        source: 'worldgovernmentbonds',
        sourceDetail: 'wp-json/common/v1/historical',
      })
      if (point) out.set(point.date, point)
    }
    cache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60_000, value: out })
    return out
  })().finally(() => inflight.delete(cacheKey))

  inflight.set(cacheKey, task)
  const points = await task
  return {
    source: 'worldgovernmentbonds',
    points,
    notes: ['source=worldgovernmentbonds', 'history=wp-json/common/v1/historical'],
  }
}
