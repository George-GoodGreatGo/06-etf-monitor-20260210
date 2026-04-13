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
