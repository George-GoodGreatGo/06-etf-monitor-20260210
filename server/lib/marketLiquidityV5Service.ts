import { fetchFinanceData } from './financeData.js'
import { buildLiquidityV5Series } from './liquidityV5.js'
import { buildEquityBondValuePctSeries } from './equityBondValue.js'
import { fetchGovBond10yYieldPctByDate } from './chinamoneyGovBond.js'
import { runAkshare } from './akshare.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'

type CacheEntry<T> = { expiresAt: number; value: T }
const cache = new Map<string, CacheEntry<unknown>>()
const diskCacheFile = path.join(process.cwd(), 'server', '.cache', 'market-liquidity-v5.json')

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

function normalizeTradeDate(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return ''
}

function ymd8ToYear(ymd8: string): number | null {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

async function readDiskCache(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(diskCacheFile, 'utf8')
    const j = JSON.parse(raw) as { value?: Record<string, unknown> } | null
    if (!j || typeof j !== 'object' || !j.value || typeof j.value !== 'object') return null
    const v = j.value as Record<string, unknown>
    if (v.success !== true) return null
    return v
  } catch {
    return null
  }
}

async function writeDiskCache(value: Record<string, unknown>) {
  try {
    await fs.mkdir(path.dirname(diskCacheFile), { recursive: true })
    const payload = { savedAt: new Date().toISOString(), value }
    await fs.writeFile(diskCacheFile, JSON.stringify(payload), 'utf8')
  } catch {
    void 0
  }
}

export async function getMarketLiquidityV5(args?: { startDate?: string; endDate?: string }) {
  const start = typeof args?.startDate === 'string' && args.startDate.trim() ? args.startDate.trim() : '20150101'
  const end = typeof args?.endDate === 'string' && args.endDate.trim() ? args.endDate.trim() : ymdToday()
  const liquidityStart = start < '20200101' ? '20200101' : start

  const cacheKey = `liquidity:v5:${start}:${end}`
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > now) return hit.value as Record<string, unknown>

  try {
    const [hs300, sh, sz, north, hs300Pe] = await Promise.all([
      fetchFinanceData({
        apiName: 'index_daily',
        params: { ts_code: '000300.SH', start_date: start, end_date: end },
        fields: 'trade_date,close',
      }),
      fetchFinanceData({
        apiName: 'daily_info',
        params: { ts_code: 'SH_MARKET', start_date: liquidityStart, end_date: end },
        fields: 'trade_date,amount,tr',
      }),
      fetchFinanceData({
        apiName: 'daily_info',
        params: { ts_code: 'SZ_MARKET', start_date: liquidityStart, end_date: end },
        fields: 'trade_date,amount,tr',
      }),
      fetchFinanceData({
        apiName: 'moneyflow_hsgt',
        params: { start_date: liquidityStart, end_date: end },
        fields: 'trade_date,north_money',
      }),
      fetchFinanceData({
        apiName: 'index_dailybasic',
        params: { ts_code: '000300.SH', start_date: start, end_date: end },
        fields: 'trade_date,pe',
      }),
    ])

    const series = buildLiquidityV5Series({ hs300, sh, sz, north })
    if (series.length === 0) {
      throw new Error('未获取到有效的指数和成交数据，可能数据源（如Tushare）限流或暂无数据。')
    }
    const last = series[series.length - 1]

    const peByDate = new Map<string, number>()
    const yield10yPctByDate = new Map<string, number>()

    for (const r of hs300Pe) {
      const d = ymd8ToYmd10((r as Record<string, unknown>).trade_date)
      const pe = typeof (r as Record<string, unknown>).pe === 'number' ? ((r as Record<string, unknown>).pe as number) : (r as Record<string, unknown>).pe == null ? NaN : Number((r as Record<string, unknown>).pe)
      if (d && Number.isFinite(pe)) peByDate.set(d, pe)
    }

    const startY = ymd8ToYear(start)
    const endY = ymd8ToYear(end)
    if (startY != null && endY != null) {
      const years: number[] = []
      for (let y = startY; y <= endY; y += 1) years.push(y)
      const limit = 3
      for (let i = 0; i < years.length; i += limit) {
        const batch = years.slice(i, i + limit)
        const results = await Promise.allSettled(batch.map((year) => fetchGovBond10yYieldPctByDate({ year })))
        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          for (const [d, y10] of r.value) yield10yPctByDate.set(d, y10)
        }
      }
    }

    if (yield10yPctByDate.size === 0) throw new Error('10Y国债收益率数据源不可用')

    const dates = series.map((p) => p.date)
    const equityBond = buildEquityBondValuePctSeries({ dates, peByDate, yield10yPctByDate })

    const notes: string[] = [
      '独家流动性指数=exp((log(成交额分位数)+log(换手率分位数)+log(北向资金分位数))/3)，分位数为360日滚动，最小有效180日。',
      '股债利差=1/沪深300PE-中国10Y国债收益率，value再取720日滚动分位（最小有效360日），分位越高代表股票相对于国债更有性价比。',
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
    await writeDiskCache(out)
    return out
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const ak = await runAkshare<{
      hs300: Record<string, unknown>[]
      sh: Record<string, unknown>[]
      sz: Record<string, unknown>[]
      north: Record<string, unknown>[]
      hs300Pe: Record<string, unknown>[]
    }>(`market-board-daily:${start}:${end}`, ['market-board-daily', '--start-date', start, '--end-date', end], {
      cacheTtlMs: 3 * 60_000,
      timeoutMs: 120_000,
    })

    if (ak.success) {
      const data = ak.data && typeof ak.data === 'object' ? (ak.data as Record<string, unknown>) : {}
      const hs300 = Array.isArray(data.hs300) ? (data.hs300 as Record<string, unknown>[]) : []
      const sh = Array.isArray(data.sh) ? (data.sh as Record<string, unknown>[]) : []
      const sz = Array.isArray(data.sz) ? (data.sz as Record<string, unknown>[]) : []
      const north = Array.isArray(data.north) ? (data.north as Record<string, unknown>[]) : []
      const hs300Pe = Array.isArray(data.hs300Pe) ? (data.hs300Pe as Record<string, unknown>[]) : []

      const series = buildLiquidityV5Series({ hs300, sh, sz, north })
      if (series.length > 0) {
        const last = series[series.length - 1]
        const peByDate = new Map<string, number>()
        const yield10yPctByDate = new Map<string, number>()

        for (const r of hs300Pe) {
          const d = normalizeTradeDate((r as Record<string, unknown>).trade_date)
          const pe = typeof (r as Record<string, unknown>).pe === 'number' ? ((r as Record<string, unknown>).pe as number) : (r as Record<string, unknown>).pe == null ? NaN : Number((r as Record<string, unknown>).pe)
          if (d && Number.isFinite(pe)) peByDate.set(d, pe)
        }

        const startY = ymd8ToYear(start)
        const endY = ymd8ToYear(end)
        if (startY != null && endY != null) {
          const years: number[] = []
          for (let y = startY; y <= endY; y += 1) years.push(y)
          const limit = 3
          for (let i = 0; i < years.length; i += limit) {
            const batch = years.slice(i, i + limit)
            const results = await Promise.allSettled(batch.map((year) => fetchGovBond10yYieldPctByDate({ year })))
            for (const r of results) {
              if (r.status !== 'fulfilled') continue
              for (const [d, y10] of r.value) yield10yPctByDate.set(d, y10)
            }
          }
        }

        const dates = series.map((p) => p.date)
        const equityBond = buildEquityBondValuePctSeries({ dates, peByDate, yield10yPctByDate })

        const notes: string[] = [
          '独家流动性指数=exp((log(成交额分位数)+log(换手率分位数)+log(北向资金分位数))/3)，分位数为360日滚动，最小有效180日。',
          '股债利差=1/沪深300PE-中国10Y国债收益率，value再取720日滚动分位（最小有效360日），分位越高代表股票相对于国债更有性价比。',
          '实时主源失败后已自动切换 AkShare 替代数据源；缺失字段保持 null，不做推测补值。',
          `主源失败原因：${msg}`,
        ]

        const out = {
          success: true,
          meta: {
            fetchedAt: new Date().toISOString(),
            dataDate: last?.date ?? null,
            source: 'akshare:eastmoney + yield.chinabond.com.cn',
            notes,
          },
          data: {
            series,
            equityBond: {
              series: equityBond,
            },
          },
        }

        cache.set(cacheKey, { expiresAt: now + 5 * 60_000, value: out })
        await writeDiskCache(out)
        return out
      }
    }

    const stale = await readDiskCache()
    if (stale) {
      const staleObj = stale as Record<string, unknown>
      const meta = staleObj.meta && typeof staleObj.meta === 'object' ? (staleObj.meta as Record<string, unknown>) : {}
      const oldNotes = Array.isArray(meta.notes) ? (meta.notes as unknown[]) : []
      const withStale = {
        ...staleObj,
        meta: {
          ...meta,
          fetchedAt: new Date().toISOString(),
          source: 'stale-cache-from-last-success',
          notes: [...oldNotes, `本次实时拉取失败，已回退上次成功快照：${msg}`],
        },
      }
      cache.set(cacheKey, { expiresAt: now + 5 * 60_000, value: withStale })
      return withStale
    }
    throw e
  }
}
