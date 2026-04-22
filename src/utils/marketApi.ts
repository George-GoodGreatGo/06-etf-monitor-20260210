import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import type { ApiErr, ApiOk } from '@/utils/etfApi'

export type LiquidityV5Point = {
  date: string
  close: number
  amount: number | null
  tr: number | null
  northMoney: number | null
  amountPct: number | null
  trPct: number | null
  northPct: number | null
  v5: number | null
  v5Pct: number | null
}

export type EquityBondPoint = {
  date: string
  pe: number | null
  earningsYield: number | null
  yield10yPct: number | null
  value: number | null
  pct: number | null
}

export type MarketLiquidityV5 = {
  series: LiquidityV5Point[]
  equityBond?: {
    series: EquityBondPoint[]
  } | null
}

type FrontCacheEntry = { expiresAt: number; value: unknown }
const FRONT_CACHE_TTL_MS = 5 * 60_000
const frontCache = new Map<string, FrontCacheEntry>()

function getFrontCache<T>(key: string): T | null {
  const hit = frontCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value as T
  return null
}

function setFrontCache<T>(key: string, value: T, ttlMs = FRONT_CACHE_TTL_MS) {
  frontCache.set(key, { expiresAt: Date.now() + ttlMs, value })
}

export type LowVolH30269Point = {
  date: string
  close: number
  ma60: number | null
  ma250: number | null
  bias60: number | null
  bias250: number | null
  biasPct3y60: number | null
  biasPct3y: number | null
  dividendYieldPct: number | null
  yield10yPct: number | null
  spreadRawPct: number | null
  spreadSmoothPct: number | null
  spreadPct: number | null
  spreadPctRank3y: number | null
  spreadPctRank10y: number | null
}

export type LowVolH30269Data = {
  series: LowVolH30269Point[]
}

export type LowVolLatestSummary = {
  date: string
  spreadPctRank10y: number | null
  biasPct3y: number | null
  biasPct3y60: number | null
  dividendYieldPct: number | null
}

export type LowVolSummaryItem = {
  code: string
  latest: LowVolLatestSummary | null
  error?: string
  message?: string
}

export type LowVolSummaryData = {
  items: LowVolSummaryItem[]
}

export type ValueTimingPoint = {
  date: string
  close: number
  ma60: number | null
  ma250: number | null
  bias60: number | null
  bias250: number | null
  biasPct3y60: number | null
  biasPct3y: number | null
  pe: number | null
  earningsYieldPct: number | null
  yield10yPct: number | null
  spreadPct: number | null
  spreadPctRank5y: number | null
  peSource: string | null
  peSourceNotes: string[]
}

export type ValueTimingData = {
  series: ValueTimingPoint[]
}

export type ValueTimingLatestSummary = {
  date: string
  spreadPctRank5y: number | null
  pe: number | null
  earningsYieldPct: number | null
  biasPct3y: number | null
  biasPct3y60: number | null
  peSource: string | null
}

export type ValueTimingSummaryItem = {
  code: string
  latest: ValueTimingLatestSummary | null
  error?: string
  message?: string
}

export type ValueTimingSummaryData = {
  items: ValueTimingSummaryItem[]
}

export type RpsStyleSeriesPoint = {
  date: string
  ticker: string
  benchmarkTicker: string
  targetCloseQfq: number
  benchmarkCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
}

export type RpsStyleSeriesData = {
  ticker: string
  benchmarkTicker: string
  benchmarkName: string
  series: RpsStyleSeriesPoint[]
}

export type RpsStyleMatrixItem = {
  ticker: string
  date: string
  targetCloseQfq: number
  benchmarkCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
  trend: 'up' | 'down' | 'flat'
}

export type RpsStyleMatrixData = {
  benchmarkTicker: string
  benchmarkName: string
  mode: 'risk_on' | 'risk_off'
  leaderTicker: string | null
  suggestedAttackPositionPct: number
  items: RpsStyleMatrixItem[]
}

export type RpsStyleSummaryData = {
  benchmarkTicker: string
  benchmarkName: string
  mode: 'risk_on' | 'risk_off'
  leaderTicker: string | null
  suggestedAttackPositionPct: number
  isFallback: boolean
  leaderScorePct: number | null
}

export type RpsStylePanelData = {
  summary: RpsStyleSummaryData
  matrix: RpsStyleMatrixData
  seriesByTicker: Record<string, RpsStyleSeriesPoint[]>
}

export type RpsCustomQueryLatest = {
  date: string
  targetCloseQfq: number
  benchmarkCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
}

export type RpsCustomQueryData = {
  inputTicker: string
  ticker: string
  code: string
  name: string
  benchmarkTicker: string
  benchmarkName: string
  latest: RpsCustomQueryLatest | null
  series: RpsStyleSeriesPoint[]
  turnoverSeries: RpsTurnoverHistoryPoint[]
}

export type RpsTurnoverBenchmarkIndex = {
  code: string
  name: string
}

export type RpsTurnoverHistoryPoint = {
  date: string
  turnover: number | null
  turnoverMultipleOfPrev20Avg: number | null
}

export type RpsTurnoverHistoryData = {
  ticker: string
  code: string
  name: string
  benchmarkTicker: string
  benchmarkName: string
  benchmarkIndex: RpsTurnoverBenchmarkIndex
  series: RpsTurnoverHistoryPoint[]
}

export type RpsTurnoverSummaryItem = {
  ticker: string
  code: string
  name: string
  latestTradingDate: string | null
  latestAmplifiedDate: string | null
  tradingDaysAgo: number | null
  status: 'hit' | 'no_signal' | 'no_data'
}

export type RpsTurnoverSummaryData = {
  items: RpsTurnoverSummaryItem[]
}

export async function fetchLowVolIndex(args: { code: string; signal?: AbortSignal }): Promise<ApiOk<LowVolH30269Data> | ApiErr> {
  const code = String(args.code || '').trim()
  const cacheKey = `lowvol:index:${code}`
  const cached = getFrontCache<ApiOk<LowVolH30269Data> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(`/api/lowvol/index/${encodeURIComponent(code)}`), {
      ...(args.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<LowVolH30269Data> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchLowVolSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<LowVolSummaryData> | ApiErr> {
  const cacheKey = 'lowvol:summary'
  const cached = getFrontCache<ApiOk<LowVolSummaryData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl('/api/lowvol/summary'), {
      ...(args?.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<LowVolSummaryData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchValueTimingIndex(args: { code: string; signal?: AbortSignal }): Promise<ApiOk<ValueTimingData> | ApiErr> {
  const code = String(args.code || '').trim()
  const cacheKey = `value:index:${code}`
  const cached = getFrontCache<ApiOk<ValueTimingData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(`/api/value/index/${encodeURIComponent(code)}`), {
      ...(args.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<ValueTimingData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchValueTimingSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<ValueTimingSummaryData> | ApiErr> {
  const cacheKey = 'value:summary'
  const cached = getFrontCache<ApiOk<ValueTimingSummaryData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl('/api/value/summary'), {
      ...(args?.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<ValueTimingSummaryData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchRpsStyleSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<RpsStyleSummaryData> | ApiErr> {
  const cacheKey = 'rps:summary'
  const cached = getFrontCache<ApiOk<RpsStyleSummaryData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl('/api/rps/summary'), {
      ...(args?.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsStyleSummaryData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchRpsStyleMatrix(args?: {
  startDate?: string
  endDate?: string
  signal?: AbortSignal
}): Promise<ApiOk<RpsStyleMatrixData> | ApiErr> {
  const qs = new URLSearchParams()
  if (args?.startDate) qs.set('startDate', args.startDate)
  if (args?.endDate) qs.set('endDate', args.endDate)
  const url = qs.toString() ? `/api/rps/matrix?${qs.toString()}` : '/api/rps/matrix'
  const cacheKey = `rps:matrix:${url}`
  const cached = getFrontCache<ApiOk<RpsStyleMatrixData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(url), {
      ...(args?.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsStyleMatrixData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchRpsStyleSeries(args: {
  ticker: string
  startDate?: string
  endDate?: string
  signal?: AbortSignal
}): Promise<ApiOk<RpsStyleSeriesData> | ApiErr> {
  const ticker = String(args.ticker || '').trim().toUpperCase()
  const qs = new URLSearchParams()
  if (args.startDate) qs.set('startDate', args.startDate)
  if (args.endDate) qs.set('endDate', args.endDate)
  const url = qs.toString() ? `/api/rps/series/${encodeURIComponent(ticker)}?${qs.toString()}` : `/api/rps/series/${encodeURIComponent(ticker)}`
  const cacheKey = `rps:series:${url}`
  const cached = getFrontCache<ApiOk<RpsStyleSeriesData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(url), {
      ...(args.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsStyleSeriesData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchRpsStylePanel(args?: {
  startDate?: string
  endDate?: string
  signal?: AbortSignal
}): Promise<ApiOk<RpsStylePanelData> | ApiErr> {
  const qs = new URLSearchParams()
  if (args?.startDate) qs.set('startDate', args.startDate)
  if (args?.endDate) qs.set('endDate', args.endDate)
  const url = qs.toString() ? `/api/rps/panel?${qs.toString()}` : '/api/rps/panel'
  const cacheKey = `rps:panel:${url}`
  const cached = getFrontCache<ApiOk<RpsStylePanelData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(url), {
      ...(args?.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsStylePanelData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchRpsCustomQuery(args: {
  ticker: string
  startDate?: string
  endDate?: string
  requestId?: string
  signal?: AbortSignal
}): Promise<ApiOk<RpsCustomQueryData> | ApiErr> {
  const ticker = String(args.ticker || '').trim().toUpperCase()
  const qs = new URLSearchParams()
  qs.set('ticker', ticker)
  if (args.startDate) qs.set('startDate', args.startDate)
  if (args.endDate) qs.set('endDate', args.endDate)
  if (args.requestId) qs.set('requestId', args.requestId)
  const url = `/api/rps/custom-query?${qs.toString()}`
  let res: Response
  try {
    res = await fetch(apiUrl(url), {
      ...(args.signal ? { signal: args.signal } : {}),
      cache: 'no-store',
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsCustomQueryData> | ApiErr
  return out
}

export async function fetchRpsTurnoverHistory(args: {
  ticker: string
  signal?: AbortSignal
}): Promise<ApiOk<RpsTurnoverHistoryData> | ApiErr> {
  const ticker = String(args.ticker || '').trim().toUpperCase()
  const url = `/api/rps/turnover/${encodeURIComponent(ticker)}`
  const cacheKey = `rps:turnover:${url}`
  const cached = getFrontCache<ApiOk<RpsTurnoverHistoryData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(url), {
      ...(args.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsTurnoverHistoryData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchRpsTurnoverSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<RpsTurnoverSummaryData> | ApiErr> {
  const url = '/api/rps/turnover-summary'
  const cacheKey = `rps:turnover-summary:${url}`
  const cached = getFrontCache<ApiOk<RpsTurnoverSummaryData> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl(url), {
      ...(args?.signal ? { signal: args.signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }
  const out = json as ApiOk<RpsTurnoverSummaryData> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchMarketLiquidityV5(signal?: AbortSignal): Promise<ApiOk<MarketLiquidityV5> | ApiErr> {
  const cacheKey = 'market:v5'
  const cached = getFrontCache<ApiOk<MarketLiquidityV5> | ApiErr>(cacheKey)
  if (cached) return cached
  let res: Response
  try {
    res = await fetch(apiUrl('/api/market/liquidity/v5'), {
      ...(signal ? { signal } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    return { success: false, error: 'api_error', message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用' }
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && json && 'message' in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).message === 'string'
        ? String((json as Record<string, unknown>).message)
        : `HTTP ${res.status}`
    return { success: false, error: res.status === 401 ? 'unauthorized' : 'api_error', message: msg }
  }

  const out = json as ApiOk<MarketLiquidityV5> | ApiErr
  if (out && typeof out === 'object' && out.success === true) setFrontCache(cacheKey, out)
  return out
}

export async function fetchLowVolH30269(signal?: AbortSignal): Promise<ApiOk<LowVolH30269Data> | ApiErr> {
  return fetchLowVolIndex({ code: 'H30269', signal })
}
