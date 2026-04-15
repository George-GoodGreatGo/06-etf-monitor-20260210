import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import type { ApiErr, ApiOk, Top100Meta } from '@/utils/etfApi'

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
  mode: 'risk_on' | 'risk_off'
  leaderTicker: string | null
  suggestedAttackPositionPct: number
  items: RpsStyleMatrixItem[]
}

export type RpsStyleSummaryData = {
  benchmarkTicker: string
  mode: 'risk_on' | 'risk_off'
  leaderTicker: string | null
  suggestedAttackPositionPct: number
  isFallback: boolean
  leaderScorePct: number | null
}

export async function fetchLowVolIndex(args: { code: string; signal?: AbortSignal }): Promise<ApiOk<LowVolH30269Data> | ApiErr> {
  const code = String(args.code || '').trim()
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
  return json as ApiOk<LowVolH30269Data> | ApiErr
}

export async function fetchLowVolSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<LowVolSummaryData> | ApiErr> {
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
  return json as ApiOk<LowVolSummaryData> | ApiErr
}

export async function fetchValueTimingIndex(args: { code: string; signal?: AbortSignal }): Promise<ApiOk<ValueTimingData> | ApiErr> {
  const code = String(args.code || '').trim()
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
  return json as ApiOk<ValueTimingData> | ApiErr
}

export async function fetchValueTimingSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<ValueTimingSummaryData> | ApiErr> {
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
  return json as ApiOk<ValueTimingSummaryData> | ApiErr
}

export async function fetchRpsStyleSummary(args?: { signal?: AbortSignal }): Promise<ApiOk<RpsStyleSummaryData> | ApiErr> {
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
  return json as ApiOk<RpsStyleSummaryData> | ApiErr
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
  return json as ApiOk<RpsStyleMatrixData> | ApiErr
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
  return json as ApiOk<RpsStyleSeriesData> | ApiErr
}

export async function fetchMarketLiquidityV5(signal?: AbortSignal): Promise<ApiOk<MarketLiquidityV5> | ApiErr> {
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

  const ok = json as ApiOk<MarketLiquidityV5>
  const meta = ok && typeof ok === 'object' && ok.meta && typeof ok.meta === 'object' ? (ok.meta as Top100Meta) : null
  if (!meta) return json as ApiOk<MarketLiquidityV5> | ApiErr
  return json as ApiOk<MarketLiquidityV5> | ApiErr
}

export async function fetchLowVolH30269(signal?: AbortSignal): Promise<ApiOk<LowVolH30269Data> | ApiErr> {
  return fetchLowVolIndex({ code: 'H30269', signal })
}
