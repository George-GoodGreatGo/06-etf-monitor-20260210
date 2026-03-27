import express, { type Request, type Response } from 'express'
import { fetchFinanceData } from '../lib/financeData.js'
import { buildLiquidityV5Series } from '../lib/liquidityV5.js'
import { buildEquityBondValuePctSeries } from '../lib/equityBondValue.js'
import { fetchGovBond10yYieldPctByDate } from '../lib/chinamoneyGovBond.js'

const router = express.Router()

type CacheEntry<T> = { expiresAt: number; value: T }
const cache = new Map<string, CacheEntry<unknown>>()

function ymdToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function ymd8ToYmd10(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d{8}$/.test(s)) return ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function ymd8ToYear(ymd8: string): number | null {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

router.get('/liquidity/v5', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  const cacheKey = 'liquidity:v5'
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > now) {
    res.status(200).json(hit.value)
    return
  }

  const start = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '20200101'
  const end = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : ymdToday()

  try {
    const [hs300, sh, sz, north, hs300Pe] = await Promise.all([
      fetchFinanceData({
        apiName: 'index_daily',
        params: { ts_code: '000300.SH', start_date: start, end_date: end },
        fields: 'trade_date,close',
      }),
      fetchFinanceData({
        apiName: 'daily_info',
        params: { ts_code: 'SH_MARKET', start_date: start, end_date: end },
        fields: 'trade_date,amount,tr',
      }),
      fetchFinanceData({
        apiName: 'daily_info',
        params: { ts_code: 'SZ_MARKET', start_date: start, end_date: end },
        fields: 'trade_date,amount,tr',
      }),
      fetchFinanceData({
        apiName: 'moneyflow_hsgt',
        params: { start_date: start, end_date: end },
        fields: 'trade_date,north_money',
      }),
      fetchFinanceData({
        apiName: 'index_dailybasic',
        params: { ts_code: '000300.SH', start_date: start, end_date: end },
        fields: 'trade_date,pe',
      }),
    ])

    const series = buildLiquidityV5Series({ hs300, sh, sz, north })
    const last = series.length ? series[series.length - 1] : null

    const peByDate = new Map<string, number>()
    const yield10yPctByDate = new Map<string, number>()

    for (const r of hs300Pe) {
      const d = ymd8ToYmd10(r.trade_date)
      const pe = typeof r.pe === 'number' ? r.pe : r.pe == null ? NaN : Number(r.pe)
      if (d && Number.isFinite(pe)) peByDate.set(d, pe)
    }

    const startY = ymd8ToYear(start)
    const endY = ymd8ToYear(end)
    if (startY != null && endY != null) {
      const years: number[] = []
      for (let y = startY; y <= endY; y += 1) years.push(y)
      try {
        const maps = await Promise.all(years.map((year) => fetchGovBond10yYieldPctByDate({ year })))
        for (const m of maps) {
          for (const [d, y10] of m) yield10yPctByDate.set(d, y10)
        }
      } catch {}
    }

    if (yield10yPctByDate.size === 0) throw new Error('10Y国债收益率数据源不可用')

    const dates = series.map((p) => p.date)
    const equityBond = buildEquityBondValuePctSeries({ dates, peByDate, yield10yPctByDate })

    const notes: string[] = [
      'V5流动性指数=exp((log(成交额分位数)+log(换手率分位数)+log(北向资金分位数))/3)，分位数为90日滚动，最小有效20日。',
      '股债性价比=1/沪深300PE-中国10Y国债收益率，value再取180日滚动分位（最小有效20日），分位越高代表股票更有性价比。',
      '股债性价比PE数据源：codebuddy:financedata(index_dailybasic)',
      '股债性价比10Y数据源：chinabond(yield.chinabond.com.cn, 整年标准期限xlsx)',
      '股债性价比对齐：以沪深300交易日为基准，缺失使用前值填充。',
    ]

    const out = {
      success: true,
      meta: {
        fetchedAt: new Date().toISOString(),
        dataDate: last?.date ?? null,
        source: 'codebuddy:financedata + yield.chinabond.com.cn',
        notes,
      },
      data: {
        series,
        equityBond: {
          series: equityBond,
        },
      },
    }

    cache.set(cacheKey, { expiresAt: now + 10 * 60_000, value: out })
    res.status(200).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ success: false, error: 'upstream_error', message: msg || '数据源调用失败' })
  }
})

export default router

