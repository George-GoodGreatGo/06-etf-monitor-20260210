import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'

export type DataStatus = 'complete' | 'incomplete' | 'api_error'

export type EtfTopRow = {
  code: string
  name: string
  latestTradingDate: string
  volume: number | null
  turnover: number | null
  turnoverChangePct1d: number | null
  turnoverChangePct7dAvg: number | null
  z90: number | null
  dataStatus: DataStatus
}

export type Top100Meta = {
  fetchedAt: string
  dataDate: string
  source?: string
  notes?: string[]
  cachedAt?: string
  backgroundRefresh?: boolean
}

export type Top100SortKey =
  | 'code'
  | 'name'
  | 'volume'
  | 'turnover'
  | 'turnoverChangePct1d'
  | 'turnoverChangePct7dAvg'
  | 'z90'

export type ApiOk<T> = {
  success: true
  meta: Top100Meta
  data: T
}

export type ApiErr = {
  success: false
  error: string
  message?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function getMessage(v: unknown): string | null {
  if (!isRecord(v)) return null
  if (!('message' in v)) return null
  const m = v.message
  return typeof m === 'string' ? m : null
}

export async function fetchEtfTop100(
  params: {
    keyword?: string
    limit?: number
    sort?: Top100SortKey
    dir?: 'asc' | 'desc'
    refreshToken?: string
    ensureLatest?: boolean
    progressToken?: string
  },
  signal?: AbortSignal,
): Promise<ApiOk<EtfTopRow[]> | ApiErr> {
  const qs = new URLSearchParams()
  if (params.keyword) qs.set('keyword', params.keyword)
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    qs.set('limit', String(params.limit))
  }
  if (params.sort) qs.set('sort', params.sort)
  if (params.dir) qs.set('dir', params.dir)
  if (params.ensureLatest) qs.set('ensureLatest', '1')
  if (params.progressToken) qs.set('_p', params.progressToken)
  if (params.refreshToken) {
    qs.set('refresh', '1')
    qs.set('_t', params.refreshToken)
  }

  const query = qs.toString()
  const url = apiUrl(query ? `/api/etf/top100?${query}` : '/api/etf/top100')

  let res: Response
  try {
    res = await fetch(url, {
      ...(signal ? { signal } : {}),
      ...(params.refreshToken ? { keepalive: true } : {}),
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.includes('net::ERR_ABORTED') || msg.toLowerCase().includes('aborted')
    return {
      success: false,
      error: 'api_error',
      message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用',
    }
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = getMessage(json) ?? `HTTP ${res.status}`
    return {
      success: false,
      error: res.status === 401 ? 'unauthorized' : 'api_error',
      message: msg,
    }
  }

  return json as ApiOk<EtfTopRow[]> | ApiErr
}

export type EtfDetail = {
  code: string
  name: string | null
  latestTradingDate: string | null
  volume: number | null
  turnover: number | null
  turnoverChangePct1d: number | null
  turnoverChangePct7dAvg: number | null
  z90: number | null
}

export type EtfWeeklyChartPoint = {
  time: number
  value: number
}

export type EtfWeeklyChartColoredPoint = {
  time: number
  value: number
  color?: string
}

export type EtfWeeklyChartSeries = {
  price: EtfWeeklyChartPoint[]
  ema20: EtfWeeklyChartPoint[]
  sma60: EtfWeeklyChartPoint[]
  bb: {
    mb: EtfWeeklyChartPoint[]
    ub: EtfWeeklyChartPoint[]
    lb: EtfWeeklyChartPoint[]
    bandwidth: EtfWeeklyChartPoint[]
  }
  volume: EtfWeeklyChartColoredPoint[]
  rsi14: EtfWeeklyChartPoint[]
  macd: {
    macd: EtfWeeklyChartPoint[]
    signal: EtfWeeklyChartPoint[]
    hist: EtfWeeklyChartColoredPoint[]
  }
}

export type EtfWeeklyChart = {
  series: EtfWeeklyChartSeries
}

export async function fetchEtfDetail(
  code: string,
  signal: AbortSignal,
): Promise<ApiOk<EtfDetail> | ApiErr> {
  let res: Response
  try {
    res = await fetch(apiUrl(`/api/etf/detail/${encodeURIComponent(code)}`), {
      signal,
      keepalive: true,
      credentials: 'include',
      headers: {
        ...adminAuthHeaders(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted = name === 'AbortError' || msg.includes('net::ERR_ABORTED') || msg.toLowerCase().includes('aborted')
    return {
      success: false,
      error: 'api_error',
      message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用',
    }
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = getMessage(json) ?? `HTTP ${res.status}`
    return {
      success: false,
      error: res.status === 401 ? 'unauthorized' : 'api_error',
      message: msg,
    }
  }

  return json as ApiOk<EtfDetail> | ApiErr
}

export async function fetchEtfWeeklyChart(
  code: string,
  signal: AbortSignal,
): Promise<ApiOk<EtfWeeklyChart> | ApiErr> {
  let res: Response
  try {
    res = await fetch(
      apiUrl(`/api/etf/${encodeURIComponent(code)}/weekly-chart?adjust=qfq`),
      {
        signal,
        keepalive: true,
        credentials: 'include',
        headers: {
          ...adminAuthHeaders(),
        },
      },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const name = e instanceof Error ? e.name : ''
    const aborted =
      name === 'AbortError' ||
      msg.includes('net::ERR_ABORTED') ||
      msg.toLowerCase().includes('aborted')
    return {
      success: false,
      error: 'api_error',
      message: aborted ? '请求已取消' : msg || '网络异常或 API 不可用',
    }
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = getMessage(json) ?? `HTTP ${res.status}`
    return {
      success: false,
      error: res.status === 401 ? 'unauthorized' : 'api_error',
      message: msg,
    }
  }

  return json as ApiOk<EtfWeeklyChart> | ApiErr
}

