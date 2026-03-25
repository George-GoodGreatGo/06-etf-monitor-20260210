import express, { type Request, type Response } from 'express'
import { readTop100InsightByDataDate, readTop100LatestSnapshot } from '../lib/supabaseRest.js'
import { getTop100InsightStatusDetail } from '../lib/top100Insight.js'
import { cozeStreamRunToSseEvents } from '../lib/coze.js'
import { buildWeeklyChartVercel } from './etf.js'
import { runAkshare } from '../lib/akshare.js'

const router = express.Router()

async function resolveDataDate(rawDataDate: unknown): Promise<string> {
  const fromQuery = typeof rawDataDate === 'string' ? rawDataDate.trim() : ''
  if (fromQuery) return fromQuery
  const snap = await readTop100LatestSnapshot()
  return snap?.data_date ? String(snap.data_date).trim() : ''
}

router.get('/top100/insight', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  const q = req.query as Record<string, unknown>
  const dataDate = await resolveDataDate(q.dataDate)

  if (!dataDate) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 dataDate' })
    return
  }

  const row = await readTop100InsightByDataDate(dataDate)
  if (!row) {
    res.status(404).json({ success: false, error: 'not_found', message: `未找到解读：dataDate=${dataDate}` })
    return
  }

  res.status(200).json({
    success: true,
    data: {
      dataDate: row.data_date,
      snapshotAt: row.snapshot_at,
      source: row.source,
      markdown: row.markdown,
      rows: row.rows,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  })
})

router.get('/top100/insight/status', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  const q = req.query as Record<string, unknown>
  const dataDate = await resolveDataDate(q.dataDate)
  if (!dataDate) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 dataDate' })
    return
  }

  const detail = await getTop100InsightStatusDetail(dataDate)
  res.status(200).json({
    success: true,
    data: {
      dataDate,
      status: detail.status,
      lastError: detail.lastError,
      updatedAt: detail.updatedAt,
    },
  })
})

router.post('/top100/insight', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const dataDate = await resolveDataDate(b.dataDate)

  if (!dataDate) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 dataDate' })
    return
  }

  const row = await readTop100InsightByDataDate(dataDate)
  if (!row) {
    res.status(404).json({ success: false, error: 'not_found', message: `未找到解读：dataDate=${dataDate}` })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    ;(res as Response & { flushHeaders?: () => void }).flushHeaders?.()
  } catch {
    void 0
  }

  res.write(': stream-open\n\n')
  res.write(`data: ${JSON.stringify({ type: 'answer', content: { answer: row.markdown }, finish: true })}\n\n`)
  res.write(`data: ${JSON.stringify({ type: 'end', status: 'success' })}\n\n`)
  res.end()
})

router.post('/etf/detail/insight', async (req: Request, res: Response) => {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    ;(res as Response & { flushHeaders?: () => void }).flushHeaders?.()
  } catch {
    void 0
  }

  const writeEvent = (o: Record<string, unknown>) => {
    try {
      res.write(`data: ${JSON.stringify(o)}\n\n`)
    } catch {
      void 0
    }
  }

  res.write(': stream-open\n\n')

  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const code = typeof b.code === 'string' ? b.code.trim() : ''
  if (!code) {
    writeEvent({ type: 'end', status: 'error', message: '缺少 code' })
    res.end()
    return
  }

  const url = String(process.env.COZE_DETAIL_STREAM_RUN_URL || '').trim()
  const token = String(process.env.COZE_DETAIL_BEARER_TOKEN || '').trim()
  if (!url || !token) {
    writeEvent({ type: 'end', status: 'error', message: '缺少服务端环境变量：COZE_DETAIL_STREAM_RUN_URL / COZE_DETAIL_BEARER_TOKEN' })
    res.end()
    return
  }

  let nameCn: string | null = null
  try {
    const snap = await readTop100LatestSnapshot()
    const row = (snap?.rows as unknown[] | undefined)?.find((r) => {
      if (!r || typeof r !== 'object') return false
      const o = r as Record<string, unknown>
      return typeof o.code === 'string' && o.code === code
    }) as Record<string, unknown> | undefined
    if (row && typeof row.name === 'string') nameCn = row.name
  } catch {
    nameCn = null
  }

  const adjust = 'qfq'
  const weeklyOut = process.env.VERCEL
    ? await buildWeeklyChartVercel(code, adjust)
    : await runAkshare(`weekly-chart:v1:${code}:${adjust}`, ['weekly-chart', '--code', code, '--adjust', adjust], {
        cacheTtlMs: 600_000,
        timeoutMs: 180_000,
      })

  if (weeklyOut.success !== true) {
    writeEvent({ type: 'end', status: 'error', message: weeklyOut.message || weeklyOut.error || '周线数据获取失败' })
    res.end()
    return
  }

  const series = (weeklyOut.data as Record<string, unknown>).series as Record<string, unknown>
  const price = Array.isArray((series as Record<string, unknown>).price) ? ((series as Record<string, unknown>).price as unknown[]) : []
  const ema20 = Array.isArray((series as Record<string, unknown>).ema20) ? ((series as Record<string, unknown>).ema20 as unknown[]) : []
  const sma60 = Array.isArray((series as Record<string, unknown>).sma60) ? ((series as Record<string, unknown>).sma60 as unknown[]) : []
  const bbObj = ((series as Record<string, unknown>).bb as Record<string, unknown>) || {}
  const bbMb = Array.isArray(bbObj.mb) ? (bbObj.mb as unknown[]) : []
  const bbUb = Array.isArray(bbObj.ub) ? (bbObj.ub as unknown[]) : []
  const bbLb = Array.isArray(bbObj.lb) ? (bbObj.lb as unknown[]) : []
  const bbBw = Array.isArray(bbObj.bandwidth) ? (bbObj.bandwidth as unknown[]) : []
  const volume = Array.isArray((series as Record<string, unknown>).volume) ? ((series as Record<string, unknown>).volume as unknown[]) : []
  const rsi14 = Array.isArray((series as Record<string, unknown>).rsi14) ? ((series as Record<string, unknown>).rsi14 as unknown[]) : []
  const macdObj = ((series as Record<string, unknown>).macd as Record<string, unknown>) || {}
  const macdLine = Array.isArray(macdObj.macd) ? (macdObj.macd as unknown[]) : []
  const macdSignal = Array.isArray(macdObj.signal) ? (macdObj.signal as unknown[]) : []
  const macdHist = Array.isArray(macdObj.hist) ? (macdObj.hist as unknown[]) : []

  const toMap = (arr: unknown[]) => {
    const m = new Map<number, number>()
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue
      const o = it as Record<string, unknown>
      const t = typeof o.time === 'number' ? o.time : Number(o.time)
      const v = typeof o.value === 'number' ? o.value : o.value == null ? NaN : Number(o.value)
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue
      m.set(t, v)
    }
    return m
  }

  const ema20Map = toMap(ema20)
  const sma60Map = toMap(sma60)
  const bbMbMap = toMap(bbMb)
  const bbUbMap = toMap(bbUb)
  const bbLbMap = toMap(bbLb)
  const bbBwMap = toMap(bbBw)
  const volumeMap = toMap(volume)
  const rsi14Map = toMap(rsi14)
  const macdLineMap = toMap(macdLine)
  const macdSignalMap = toMap(macdSignal)
  const macdHistMap = toMap(macdHist)

  const rows = []
  for (const it of price) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const t = typeof o.time === 'number' ? o.time : Number(o.time)
    const v = typeof o.value === 'number' ? o.value : o.value == null ? NaN : Number(o.value)
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue
    const d = new Date(t)
    const ymd = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''

    rows.push({
      week_end_date: ymd,
      week_end_utc_ms: t,
      close_price_qfq: v,
      ema_20w: ema20Map.get(t) ?? null,
      sma_60w: sma60Map.get(t) ?? null,
      bollinger_20w_2sd: {
        middle: bbMbMap.get(t) ?? null,
        upper: bbUbMap.get(t) ?? null,
        lower: bbLbMap.get(t) ?? null,
        bandwidth: bbBwMap.get(t) ?? null,
      },
      volume_week: volumeMap.get(t) ?? null,
      rsi_14w: rsi14Map.get(t) ?? null,
      macd_12_26_9: {
        line: macdLineMap.get(t) ?? null,
        signal: macdSignalMap.get(t) ?? null,
        hist: macdHistMap.get(t) ?? null,
      },
    })
  }

  const maxWeeks = 200
  const trimmedRows = rows.slice(Math.max(0, rows.length - maxWeeks))

  const payload = {
    symbol: code,
    name_cn: nameCn,
    adjustment: adjust,
    freq: 'W',
    weekly_count: trimmedRows.length,
    data: trimmedRows,
  }

  try {
    await cozeStreamRunToSseEvents(JSON.stringify(payload), {
      url,
      token,
      onEvent: writeEvent,
    })
  } catch (e) {
    writeEvent({ type: 'end', status: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    res.end()
  }
})

export default router
