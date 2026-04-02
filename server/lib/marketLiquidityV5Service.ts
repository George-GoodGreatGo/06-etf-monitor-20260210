import { fetchFinanceData } from './financeData.js'
import { buildLiquidityV5Series } from './liquidityV5.js'
import { buildEquityBondValuePctSeries } from './equityBondValue.js'
import { fetchGovBond10yYieldPctByDate } from './chinamoneyGovBond.js'
import { runAkshare } from './akshare.js'
import { fetchCsindexHs300PeSeries } from './csindex.js'
import { fetchNorthboundNetInflowSeries } from './hkex.js'
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

async function fetchEastmoneyIndexDaily(args: {
  secid: string
  start: string
  end: string
}): Promise<Record<string, unknown>[]> {
  const u = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  u.searchParams.set('secid', args.secid)
  u.searchParams.set('klt', '101')
  u.searchParams.set('fqt', '0')
  u.searchParams.set('beg', args.start)
  u.searchParams.set('end', args.end)
  u.searchParams.set('lmt', '5000')
  u.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
  u.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61')

  const r = await fetch(u.toString(), { method: 'GET', headers: { Accept: 'application/json, text/plain, */*' } })
  if (!r.ok) throw new Error(`eastmoney kline failed: HTTP ${r.status}`)
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
  const data = j && typeof j === 'object' && j.data && typeof j.data === 'object' ? (j.data as Record<string, unknown>) : null
  const kl = data && Array.isArray(data.klines) ? (data.klines as unknown[]) : []
  const out: Record<string, unknown>[] = []
  for (const row of kl) {
    const s = typeof row === 'string' ? row : ''
    if (!s) continue
    const p = s.split(',')
    if (p.length < 11) continue
    const d = String(p[0] || '').trim().replace(/-/g, '')
    if (!/^\d{8}$/.test(d)) continue
    const close = Number(p[2])
    const amount = Number(p[6])
    const tr = Number(p[10])
    out.push({
      trade_date: d,
      close: Number.isFinite(close) ? close : null,
      amount: Number.isFinite(amount) ? amount / 1000 : null,
      tr: Number.isFinite(tr) ? tr : null,
    })
  }
  return out
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
  const noPythonRuntime = Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  const defaultPolicy = noPythonRuntime ? 'eastmoney-http' : 'akshare-first'
  const sourcePolicy = String(process.env.MARKET_DATA_SOURCE || defaultPolicy).trim().toLowerCase()

  const tryEastmoneyHttpFallback = async (reason: string) => {
    try {
      const [hs300Raw, shRaw, szRaw] = await Promise.all([
        fetchEastmoneyIndexDaily({ secid: '1.000300', start, end }),
        fetchEastmoneyIndexDaily({ secid: '1.000001', start: liquidityStart, end }),
        fetchEastmoneyIndexDaily({ secid: '0.399001', start: liquidityStart, end }),
      ])

      const hs300 = hs300Raw.map((r) => ({ trade_date: r.trade_date, close: r.close }))
      const sh = shRaw.map((r) => ({ trade_date: r.trade_date, amount: r.amount, tr: r.tr }))
      const sz = szRaw.map((r) => ({ trade_date: r.trade_date, amount: r.amount, tr: r.tr }))
      const [north, hs300Pe] = await Promise.all([
        fetchNorthboundNetInflowSeries({ startDate: liquidityStart, endDate: end }),
        fetchCsindexHs300PeSeries({ startDate: start, endDate: end }),
      ])

      const series = buildLiquidityV5Series({ hs300, sh, sz, north })
      if (series.length === 0) return { ok: false as const, err: 'Eastmoney HTTP 替代源返回为空' }
      const last = series[series.length - 1]

      const yield10yPctByDate = new Map<string, number>()
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

      const peByDate = new Map<string, number>()
      for (const r of hs300Pe) {
        const d = ymd8ToYmd10((r as Record<string, unknown>).trade_date)
        const pe =
          typeof (r as Record<string, unknown>).pe === 'number'
            ? ((r as Record<string, unknown>).pe as number)
            : (r as Record<string, unknown>).pe == null
              ? NaN
              : Number((r as Record<string, unknown>).pe)
        if (d && Number.isFinite(pe)) peByDate.set(d, pe)
      }

      const equityBond =
        yield10yPctByDate.size > 0
          ? buildEquityBondValuePctSeries({ dates: series.map((p) => p.date), peByDate, yield10yPctByDate })
          : []
      const notes: string[] = [
        '已使用 Eastmoney HTTP 替代数据源（无 Python 依赖），缺失字段保持 null，不做推测补值。',
        `成交额口径：来自 Eastmoney kline 成交额，已换算为“千元”（与表格视图一致）。`,
        '沪深300PE数据源：中证指数（csindex）。',
        '北向资金净流入数据源：东方财富数据中心（reportName=RPT_MUTUAL_NETINFLOW_DETAILS, 字段 NET_INFLOW_BOTH，单位=百万元）。',
        `替代触发原因：${reason}`,
      ]
      const out = {
        success: true,
        meta: {
          fetchedAt: new Date().toISOString(),
          dataDate: last?.date ?? null,
          source: 'eastmoney:http + csindex + eastmoney:datacenter + yield.chinabond.com.cn',
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
      return { ok: true as const, out }
    } catch (e) {
      return { ok: false as const, err: e instanceof Error ? e.message : String(e) }
    }
  }

  const tryAkshare = async (primaryFailReason?: string) => {
    if (noPythonRuntime) {
      return {
        ok: false as const,
        err: '当前运行环境不提供可执行的 Python（Serverless 运行时不支持通过子进程调用本机 Python）',
      }
    }
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

    if (!ak.success) {
      return {
        ok: false as const,
        err: ((ak as unknown as Record<string, unknown>).message as string) || 'AkShare 替代源调用失败',
      }
    }

    const data = ak.data && typeof ak.data === 'object' ? (ak.data as Record<string, unknown>) : {}
    const hs300 = Array.isArray(data.hs300) ? (data.hs300 as Record<string, unknown>[]) : []
    const sh = Array.isArray(data.sh) ? (data.sh as Record<string, unknown>[]) : []
    const sz = Array.isArray(data.sz) ? (data.sz as Record<string, unknown>[]) : []
    const north = Array.isArray(data.north) ? (data.north as Record<string, unknown>[]) : []
    const hs300Pe = Array.isArray(data.hs300Pe) ? (data.hs300Pe as Record<string, unknown>[]) : []

    const series = buildLiquidityV5Series({ hs300, sh, sz, north })
    if (series.length === 0) {
      return { ok: false as const, err: 'AkShare 返回数据不足以构建流动性序列' }
    }

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
      '已使用 AkShare 替代数据源；缺失字段保持 null，不做推测补值。',
      ...(primaryFailReason ? [`主源失败原因：${primaryFailReason}`] : []),
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
    return { ok: true as const, out }
  }

  if (sourcePolicy === 'eastmoney-http') {
    const emFirst = await tryEastmoneyHttpFallback('优先策略：Eastmoney HTTP（无 Python 依赖）')
    if (emFirst.ok) return emFirst.out
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
          notes: [...oldNotes, `Eastmoney HTTP 实时拉取失败，已回退上次成功快照：${emFirst.err}`],
        },
      }
      cache.set(cacheKey, { expiresAt: now + 5 * 60_000, value: withStale })
      return withStale
    }
    throw new Error(`替代数据源不可用：Eastmoney=${emFirst.err}`)
  }

  if (sourcePolicy !== 'financedata') {
    const akFirst = await tryAkshare()
    if (akFirst.ok) return akFirst.out
    const emFirst = await tryEastmoneyHttpFallback(`AkShare 不可用：${akFirst.err}`)
    if (emFirst.ok) return emFirst.out
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
          notes: [...oldNotes, `替代源实时拉取失败，已回退上次成功快照：AkShare=${akFirst.err}; Eastmoney=${emFirst.err}`],
        },
      }
      cache.set(cacheKey, { expiresAt: now + 5 * 60_000, value: withStale })
      return withStale
    }
    throw new Error(`替代数据源不可用：AkShare=${akFirst.err}; Eastmoney=${emFirst.err}`)
  }

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

    const dates = series.map((p) => p.date)
    const equityBond = yield10yPctByDate.size > 0 ? buildEquityBondValuePctSeries({ dates, peByDate, yield10yPctByDate }) : []

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
    const akAfterFail = await tryAkshare(msg)
    if (akAfterFail.ok) return akAfterFail.out
    const emAfterFail = await tryEastmoneyHttpFallback(`主源失败：${msg}; AkShare 失败：${akAfterFail.err}`)
    if (emAfterFail.ok) return emAfterFail.out

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
          notes: [...oldNotes, `本次实时拉取失败，已回退上次成功快照：主源=${msg}; AkShare=${akAfterFail.err}; Eastmoney=${emAfterFail.err}`],
        },
      }
      cache.set(cacheKey, { expiresAt: now + 5 * 60_000, value: withStale })
      return withStale
    }
    throw new Error(`实时主源与替代数据源均不可用：主源=${msg}；AkShare=${akAfterFail.err}；Eastmoney=${emAfterFail.err}`)
  }
}
