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

