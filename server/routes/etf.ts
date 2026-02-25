import express, { type Request, type Response } from 'express'
import { runAkshare } from '../lib/akshare.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTop100LatestSnapshot } from '../lib/supabaseRest.js'
import { ensureTop100Insight } from '../lib/top100Insight.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pythonCacheDir = path.join(__dirname, '..', 'python', '.cache')

type WeeklySeriesPoint = { time: number; value: number; color?: string }
type WeeklyChartSeries = {
  price: WeeklySeriesPoint[]
  ema8: WeeklySeriesPoint[]
  sma200: WeeklySeriesPoint[]
  volume: WeeklySeriesPoint[]
  rsi14: WeeklySeriesPoint[]
  macd: {
    macd: WeeklySeriesPoint[]
    signal: WeeklySeriesPoint[]
    hist: WeeklySeriesPoint[]
  }
}

type WeeklyChartOut =
  | { success: true; meta: Record<string, unknown>; data: { series: WeeklyChartSeries } }
  | { success: false; error: string; message: string }

const vercelWeeklyCache = new Map<string, { expiresAt: number; value: WeeklyChartOut }>()
const vercelWeeklyInflight = new Map<string, Promise<WeeklyChartOut>>()

function isoNow(): string {
  return new Date().toISOString()
}

function ymdToUtcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`)
}

function ymdToShanghaiDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const ms = Date.parse(`${ymd}T00:00:00+08:00`)
  if (Number.isNaN(ms)) return null
  return new Date(ms)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400_000)
}

function formatYmdUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function calcEma(values: number[], span: number): number[] {
  const k = 2 / (span + 1)
  const out: number[] = new Array(values.length)
  let prev = values[0] ?? 0
  out[0] = prev
  for (let i = 1; i < values.length; i++) {
    const v = values[i] ?? prev
    prev = prev + k * (v - prev)
    out[i] = prev
  }
  return out
}

function calcSma(values: number[], window: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

function calcRsi14(values: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length < 2) return out

  const gains: number[] = new Array(values.length).fill(0)
  const losses: number[] = new Array(values.length).fill(0)
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    gains[i] = diff > 0 ? diff : 0
    losses[i] = diff < 0 ? -diff : 0
  }

  if (values.length <= period) return out

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i]
    avgLoss += losses[i]
  }
  avgGain /= period
  avgLoss /= period

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss
  out[period] = avgLoss === 0 && avgGain === 0 ? 50 : 100 - 100 / (1 + rs0)

  for (let i = period + 1; i < values.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
    out[i] = avgLoss === 0 && avgGain === 0 ? 50 : 100 - 100 / (1 + rs)
  }
  return out
}

async function fetchEastmoneyDaily(
  code: string,
  fqt: number,
  beg: string,
  end: string,
): Promise<Array<{ ymd: string; open: number; close: number; volume: number }>> {
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const baseParams = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: '101',
    fqt: String(fqt),
    beg,
    end,
  })

  async function fetchForSecid(secid: string) {
    const u = new URL(url)
    const p = new URLSearchParams(baseParams)
    p.set('secid', secid)
    u.search = p.toString()
    const r = await fetch(u.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json,text/plain,*/*',
        Referer: 'https://quote.eastmoney.com/',
      },
    })
    if (!r.ok) throw new Error(`eastmoney_http_${r.status}`)
    const j = (await r.json()) as unknown
    return j as { data?: { klines?: string[] } }
  }

  let klines: string[] | undefined
  for (const marketId of ['1', '0']) {
    try {
      const j = await fetchForSecid(`${marketId}.${code}`)
      klines = j?.data?.klines
      if (Array.isArray(klines) && klines.length > 0) break
    } catch {
      void 0
    }
  }

  if (!Array.isArray(klines) || klines.length === 0) return []

  const out: Array<{ ymd: string; open: number; close: number; volume: number }> = []
  for (const row of klines) {
    const parts = String(row || '').split(',')
    if (parts.length < 7) continue
    const ymd = parts[0]
    const open = Number(parts[1])
    const close = Number(parts[2])
    const volume = Number(parts[5])
    if (!ymd || !Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(volume)) continue
    out.push({ ymd, open, close, volume })
  }
  return out
}

function aggregateWeeklyFromDaily(
  daily: Array<{ ymd: string; open: number; close: number; volume: number }>,
): Array<{ ymd: string; open: number; close: number; volume: number }> {
  const map = new Map<number, { ymd: string; open: number; close: number; volume: number; lastMs: number }>()
  for (const d of daily) {
    const dt = ymdToShanghaiDate(d.ymd)
    if (!dt) continue
    const dow = dt.getDay()
    const delta = (5 - dow + 7) % 7
    const weekEnd = addDays(dt, delta)
    const key = weekEnd.getTime()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ymd: formatYmdUtc(weekEnd), open: d.open, close: d.close, volume: d.volume, lastMs: dt.getTime() })
      continue
    }
    existing.volume += d.volume
    if (dt.getTime() > existing.lastMs) {
      existing.lastMs = dt.getTime()
      existing.close = d.close
    }
  }
  const keys = Array.from(map.keys()).sort((a, b) => a - b)
  return keys.map((k) => {
    const v = map.get(k)!
    return { ymd: v.ymd, open: v.open, close: v.close, volume: v.volume }
  })
}

async function buildWeeklyChartVercel(code: string, adjust: string): Promise<WeeklyChartOut> {
  const cacheKey = `weekly-chart:v2:${code}:${adjust}`
  const now = Date.now()
  const cached = vercelWeeklyCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.value

  const inflight = vercelWeeklyInflight.get(cacheKey)
  if (inflight) return inflight

  const p = (async () => {
    try {
      const fqt = adjust === 'qfq' ? 1 : adjust === 'hfq' ? 2 : 0
      const end = new Date()
      const endYmd = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`
      const daily = await fetchEastmoneyDaily(code, fqt, '20100101', endYmd)
      if (!daily.length) {
        const out: WeeklyChartOut = { success: false, error: 'akshare_error', message: '无法获取历史日线数据' }
        vercelWeeklyCache.set(cacheKey, { expiresAt: now + 30_000, value: out })
        return out
      }

      const weekly = aggregateWeeklyFromDaily(daily)
      const closes = weekly.map((x) => x.close)
      if (!closes.length) {
        const out: WeeklyChartOut = { success: false, error: 'akshare_error', message: '周线聚合结果为空' }
        vercelWeeklyCache.set(cacheKey, { expiresAt: now + 30_000, value: out })
        return out
      }

      const ema8 = calcEma(closes, 8)
      const sma200 = calcSma(closes, 200)
      const rsi14 = calcRsi14(closes, 14)
      const ema12 = calcEma(closes, 12)
      const ema26 = calcEma(closes, 26)
      const macdLine = closes.map((_, i) => ema12[i] - ema26[i])
      const signal = calcEma(macdLine, 9)
      const hist = macdLine.map((v, i) => v - signal[i])

      const fetchedAt = isoNow()
      const dataDate = daily[daily.length - 1]?.ymd
      const lastDailyDt = ymdToShanghaiDate(dataDate) ?? new Date()
      const isPartialWeek = lastDailyDt.getDay() !== 5

      const priceSeries: WeeklySeriesPoint[] = []
      const ema8Series: WeeklySeriesPoint[] = []
      const sma200Series: WeeklySeriesPoint[] = []
      const volumeSeries: WeeklySeriesPoint[] = []
      const rsiSeries: WeeklySeriesPoint[] = []
      const macdSeries: WeeklySeriesPoint[] = []
      const signalSeries: WeeklySeriesPoint[] = []
      const histSeries: WeeklySeriesPoint[] = []

      let prevClose: number | null = null
      for (let i = 0; i < weekly.length; i++) {
        const t = ymdToUtcMs(weekly[i].ymd)
        const cVal = closes[i]

        priceSeries.push({ time: t, value: cVal })
        ema8Series.push({ time: t, value: ema8[i] })
        const s200 = sma200[i]
        if (s200 != null) sma200Series.push({ time: t, value: s200 })

        let vColor = '#A9B6CC'
        if (prevClose != null) {
          if (cVal > prevClose) vColor = '#EF4444'
          else if (cVal < prevClose) vColor = '#10B981'
        }
        volumeSeries.push({ time: t, value: Math.round(weekly[i].volume), color: vColor })

        const r = rsi14[i]
        if (r != null) rsiSeries.push({ time: t, value: r })

        macdSeries.push({ time: t, value: macdLine[i] })
        signalSeries.push({ time: t, value: signal[i] })
        const h = hist[i]
        histSeries.push({ time: t, value: h, color: h > 0 ? '#EF4444' : h < 0 ? '#10B981' : '#A9B6CC' })

        prevClose = cVal
      }

      const series: WeeklyChartSeries = {
        price: priceSeries,
        ema8: ema8Series,
        sma200: sma200Series,
        volume: volumeSeries,
        rsi14: rsiSeries,
        macd: { macd: macdSeries, signal: signalSeries, hist: histSeries },
      }

      const out: WeeklyChartOut = {
        success: true,
        meta: {
          fetchedAt,
          snapshotAt: fetchedAt,
          dataDate,
          code,
          adjust,
          freq: 'W',
          isPartialWeek,
          source: 'eastmoney:kline',
        },
        data: { series },
      }

      vercelWeeklyCache.set(cacheKey, { expiresAt: now + 600_000, value: out })
      return out
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const out: WeeklyChartOut = { success: false, error: 'akshare_error', message: msg || '数据源调用失败' }
      vercelWeeklyCache.set(cacheKey, { expiresAt: now + 30_000, value: out })
      return out
    } finally {
      vercelWeeklyInflight.delete(cacheKey)
    }
  })()

  vercelWeeklyInflight.set(cacheKey, p)
  return p
}

function sanitizeProgressToken(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  if (t.length > 64) return null
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null
  return t
}

function progressFilePath(token: string): string {
  const p = path.join(pythonCacheDir, `progress_${token}.json`)
  const resolved = path.resolve(p)
  const base = path.resolve(pythonCacheDir)
  if (!resolved.startsWith(base)) {
    return path.join(pythonCacheDir, 'progress_invalid.json')
  }
  return resolved
}

router.get('/progress', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  if (process.env.VERCEL) {
    res.status(200).json({ success: true, data: null })
    return
  }

  const token = sanitizeProgressToken(req.query._p)
  if (!token) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 _p' })
    return
  }

  try {
    const text = await fs.readFile(progressFilePath(token), 'utf-8')
    const j = JSON.parse(text) as unknown
    res.status(200).json({ success: true, data: j })
  } catch {
    res.status(200).json({ success: true, data: null })
  }
})

router.get('/top100', (req: Request, res: Response) => {
  const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : ''
  const limit = Math.max(1, Math.min(200, Number.parseInt(limitRaw || '100', 10) || 100))

  const refresh =
    req.query.refresh === '1' ||
    (typeof req.query._t === 'string' && req.query._t.trim().length > 0)
  const refreshToken = typeof req.query._t === 'string' ? req.query._t : ''

  const ensureLatest = req.query.ensureLatest === '1'
  const progressToken = sanitizeProgressToken(req.query._p)
  const progressFile = progressToken ? progressFilePath(progressToken) : ''

  if (process.env.VERCEL) {
    void (async () => {
      const snap = await readTop100LatestSnapshot()
      if (!snap || !Array.isArray(snap.rows)) {
        res.status(503).json({
          success: false,
          error: 'cache_miss',
          message: 'Supabase 未找到 Top100 快照数据，请先写入 `top100_latest(id=1)`',
        })
        return
      }

      const notes: string[] = Array.isArray(snap.notes) ? (snap.notes as unknown[]).filter((x) => typeof x === 'string') as string[] : []
      if (refresh || ensureLatest) {
        notes.unshift('当前部署环境不支持实时重算；refresh/ensureLatest 会退化为读取 Supabase 最新快照。')
        const snapshotAt = (snap.cached_at || snap.fetched_at || null) as string | null
        void ensureTop100Insight(
          String(snap.data_date || ''),
          snapshotAt,
          (snap.source || 'supabase:snapshot') as string,
          snap.rows as unknown[],
        ).catch((e) => {
          console.warn('ensureTop100Insight failed', e instanceof Error ? e.message : String(e))
          return null
        })
      }

      res.status(200).json({
        success: true,
        meta: {
          fetchedAt: snap.fetched_at,
          dataDate: snap.data_date,
          cachedAt: snap.cached_at || undefined,
          source: snap.source || 'supabase:snapshot',
          notes,
          backgroundRefresh: refresh || ensureLatest ? true : undefined,
        },
        data: (snap.rows as unknown[]).slice(0, limit),
      })
    })()
    return
  }

  if (!refresh && !ensureLatest) {
    const cacheFile = path.join(pythonCacheDir, 'top100_latest.json')
    fs.readFile(cacheFile, 'utf-8')
      .then((text) => {
        const j = JSON.parse(text) as unknown
        if (!j || typeof j !== 'object') throw new Error('bad_cache')
        const o = j as Record<string, unknown>
        const cachedAt = typeof o.cachedAt === 'string' ? o.cachedAt : ''
        const dataDate = typeof o.dataDate === 'string' ? o.dataDate : ''
        const rows = Array.isArray(o.rows) ? (o.rows as unknown[]) : null
        if (!cachedAt || !dataDate || !rows || rows.length === 0) throw new Error('bad_cache')

        res.status(200).json({
          success: true,
          meta: {
            fetchedAt: cachedAt,
            dataDate,
            cachedAt,
            source: 'akshare:sina',
            notes: [
              'Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。',
              '成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。',
            ],
          },
          data: rows.slice(0, limit),
        })
      })
      .catch(() => {
        res.status(503).json({
          success: false,
          error: 'cache_miss',
          message: '未命中本地缓存，请点击“重新获取”',
        })
      })
    return
  }

  runAkshare(
    refresh
      ? `top100:v11:${limit}:refresh:${refreshToken || Date.now()}`
      : ensureLatest
        ? `top100:v11:${limit}:ensureLatest:${Date.now()}`
        : `top100:v11:${limit}`,
    refresh
      ? ['top100', '--limit', String(limit), '--refresh', ...(progressFile ? ['--progress-file', progressFile] : [])]
      : ensureLatest
        ? [
            'top100',
            '--limit',
            String(limit),
            '--ensure-latest',
            ...(progressFile ? ['--progress-file', progressFile] : []),
          ]
        : ['top100', '--limit', String(limit), ...(progressFile ? ['--progress-file', progressFile] : [])],
    { cacheTtlMs: refresh || ensureLatest ? 0 : 600_000, timeoutMs: 900_000 },
  )
    .then((out) => {
      if (out.success === true) {
        res.status(200).json(out)
        if (refresh || ensureLatest) {
          const meta = (out.meta || {}) as Record<string, unknown>
          const dataDate = typeof meta.dataDate === 'string' ? meta.dataDate : ''
          const fetchedAt = typeof meta.fetchedAt === 'string' ? meta.fetchedAt : null
          const cachedAt = typeof meta.cachedAt === 'string' ? meta.cachedAt : null
          const source = typeof meta.source === 'string' ? meta.source : null
          const snapshotAt = cachedAt || fetchedAt
          const rows = Array.isArray(out.data) ? (out.data as unknown[]) : []
          if (dataDate && rows.length > 0) {
            void ensureTop100Insight(dataDate, snapshotAt, source, rows).catch((e) => {
              console.warn('ensureTop100Insight failed', e instanceof Error ? e.message : String(e))
              return null
            })
          }
        }
        if (progressFile) void fs.unlink(progressFile).catch(() => null)
        return
      }

      if (out.error === 'cache_miss') {
        res.status(503).json(out)
        if (progressFile) void fs.unlink(progressFile).catch(() => null)
        return
      }

      const msg = out.message || ''
      const status = msg.includes('未检测到') ? 501 : 502
      res.status(status).json(out)
      if (progressFile) void fs.unlink(progressFile).catch(() => null)
    })
    .catch((e) => {
      res.status(502).json({
        success: false,
        error: 'akshare_error',
        message: e instanceof Error ? e.message : String(e),
      })
      if (progressFile) void fs.unlink(progressFile).catch(() => null)
    })
})

router.get('/detail/:code', (req: Request, res: Response) => {
  const code = String(req.params.code || '').trim()
  if (!code) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 code' })
    return
  }

  if (process.env.VERCEL) {
    void (async () => {
      const snap = await readTop100LatestSnapshot()
      if (!snap || !Array.isArray(snap.rows)) {
        res.status(503).json({
          success: false,
          error: 'cache_miss',
          message: 'Supabase 未找到 Top100 快照数据，请先写入 `top100_latest(id=1)`',
        })
        return
      }

      const row = (snap.rows as unknown[]).find((r) =>
        typeof r === 'object' && r !== null && 'code' in r && String((r as Record<string, unknown>).code) === code,
      ) as Record<string, unknown> | undefined

      if (!row) {
        res.status(404).json({ success: false, error: 'not_found', message: '未找到该 ETF' })
        return
      }

      res.status(200).json({
        success: true,
        meta: {
          fetchedAt: snap.fetched_at,
          dataDate: snap.data_date,
          cachedAt: snap.cached_at || undefined,
          source: snap.source || 'supabase:snapshot',
        },
        data: {
          code,
          name: typeof row.name === 'string' ? row.name : null,
          latestTradingDate: typeof row.latestTradingDate === 'string' ? row.latestTradingDate : null,
          z90: typeof row.z90 === 'number' ? row.z90 : null,
        },
      })
    })()
    return
  }

  runAkshare(`detail:${code}`, ['detail', '--code', code], {
    cacheTtlMs: 120_000,
    timeoutMs: 60_000,
  })
    .then((out) => {
      if (out.success === true) {
        res.status(200).json(out)
        return
      }
      const msg = out.message || ''
      const status = msg.includes('未检测到') ? 501 : 502
      res.status(status).json(out)
    })
    .catch((e) => {
      res.status(502).json({
        success: false,
        error: 'akshare_error',
        message: e instanceof Error ? e.message : String(e),
      })
    })
})

router.get('/:code/weekly-chart', (req: Request, res: Response) => {
  const code = String(req.params.code || '').trim()
  if (!code) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 code' })
    return
  }

  const adjustRaw = typeof req.query.adjust === 'string' ? req.query.adjust : ''
  const adjust = (adjustRaw || 'qfq').trim().toLowerCase()
  if (adjust !== 'qfq' && adjust !== 'hfq' && adjust !== 'none') {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'adjust 仅支持 qfq/hfq/none',
    })
    return
  }

  if (process.env.VERCEL) {
    void (async () => {
      const out = await buildWeeklyChartVercel(code, adjust)
      if (out.success === true) {
        res.status(200).json(out)
        return
      }
      if (out.error === 'bad_request') {
        res.status(400).json(out)
        return
      }
      res.status(502).json(out)
    })()
    return
  }

  runAkshare(`weekly-chart:v1:${code}:${adjust}`, ['weekly-chart', '--code', code, '--adjust', adjust], {
    cacheTtlMs: 600_000,
    timeoutMs: 180_000,
  })
    .then((out) => {
      if (out.success === true) {
        res.status(200).json(out)
        return
      }

      if (out.error === 'bad_request') {
        res.status(400).json(out)
        return
      }

      if (out.error === 'not_supported') {
        res.status(501).json(out)
        return
      }

      if (out.error === 'cache_miss') {
        res.status(503).json(out)
        return
      }

      const msg = out.message || ''
      const status = msg.includes('未检测到') ? 501 : 502
      res.status(status).json(out)
    })
    .catch((e) => {
      res.status(502).json({
        success: false,
        error: 'akshare_error',
        message: e instanceof Error ? e.message : String(e),
      })
    })
})

export default router
