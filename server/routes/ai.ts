import express, { type Request, type Response } from 'express'
import { readTop100LatestSnapshot } from '../lib/supabaseRest.js'
import { randomUUID } from 'node:crypto'

const router = express.Router()

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

function buildPromptText(snap: {
  data_date?: string | null
  cached_at?: string | null
  fetched_at?: string | null
  source?: string | null
  rows?: unknown
}) {
  const snapshotAt = snap.cached_at || snap.fetched_at || null
  const rows = Array.isArray(snap.rows) ? (snap.rows as unknown[]) : []

  const payload = {
    snapshot: {
      dataDate: snap.data_date || null,
      snapshotAt,
      source: snap.source || 'supabase:snapshot',
      count: rows.length,
    },
    rows: rows.map((r) => {
      if (!r || typeof r !== 'object') return r
      const o = r as Record<string, unknown>
      return {
        latestTradingDate: typeof o.latestTradingDate === 'string' ? o.latestTradingDate : null,
        code: typeof o.code === 'string' ? o.code : null,
        name: typeof o.name === 'string' ? o.name : null,
        volume: typeof o.volume === 'number' ? o.volume : o.volume == null ? null : Number(o.volume),
        turnover: typeof o.turnover === 'number' ? o.turnover : o.turnover == null ? null : Number(o.turnover),
        turnoverChangePct1d:
          typeof o.turnoverChangePct1d === 'number' ? o.turnoverChangePct1d : o.turnoverChangePct1d == null ? null : Number(o.turnoverChangePct1d),
        turnoverChangePct7dAvg:
          typeof o.turnoverChangePct7dAvg === 'number'
            ? o.turnoverChangePct7dAvg
            : o.turnoverChangePct7dAvg == null
              ? null
              : Number(o.turnoverChangePct7dAvg),
        z90: typeof o.z90 === 'number' ? o.z90 : o.z90 == null ? null : Number(o.z90),
        dataStatus: typeof o.dataStatus === 'string' ? o.dataStatus : null,
      }
    }),
  }

  return [
    '你是一名专业的中国ETF市场分析师。请基于以下 Top100 ETF 异动监测快照数据，给出当天的解读。',
    '要求：',
    '1) 用中文输出；',
    '2) 先给 3-5 条总览结论；',
    '3) 再给 5-10 条重点异动（指出代码/名称/成交额/环比/较7日均/90日Z，并解释可能原因）；',
    '4) 明确说明“这是一份快照数据”，并引用快照时间；',
    '5) 不要编造数据；如果字段为空请说明“数据不完整/不可用”。',
    '',
    '数据如下（JSON）：',
    JSON.stringify(payload),
  ].join('\n')
}

router.post('/top100/insight', async (req: Request, res: Response) => {
  void req

  res.setHeader('Cache-Control', 'no-store')

  let token: string
  let url: string
  try {
    token = mustEnv('COZE_BEARER_TOKEN')
    url = String(process.env.COZE_STREAM_RUN_URL || 'https://f87gr4kxcm.coze.site/stream_run').trim()
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'missing_env',
      message: e instanceof Error ? e.message : String(e),
    })
    return
  }

  const projectIdRaw = String(process.env.COZE_PROJECT_ID || '').trim()
  const sessionId = String(process.env.COZE_SESSION_ID || '').trim() || randomUUID()

  const snap = await readTop100LatestSnapshot()
  if (!snap || !Array.isArray(snap.rows)) {
    res.status(503).json({
      success: false,
      error: 'cache_miss',
      message: 'Supabase 未找到 Top100 快照数据，请先写入 `top100_latest(id=1)`',
    })
    return
  }

  const text = buildPromptText(snap)
  const body: Record<string, unknown> = {
    content: {
      query: {
        prompt: [
          {
            type: 'text',
            content: {
              text,
            },
          },
        ],
      },
    },
    type: 'query',
  }

  body.session_id = sessionId

  if (projectIdRaw) {
    body.project_id = Number.isFinite(Number(projectIdRaw)) ? Number(projectIdRaw) : projectIdRaw
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, text/plain, application/json',
    },
    body: JSON.stringify(body),
  })

  if (!upstream.ok || !upstream.body) {
    const msg = await upstream.text().catch(() => '')
    res.status(502).json({
      success: false,
      error: 'coze_error',
      message: `Coze 调用失败：HTTP ${upstream.status} ${msg}`,
    })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    ;(res as any).flushHeaders?.()
  } catch {
    void 0
  }

  res.write(': stream-open\n\n')

  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
  const isEventStream = contentType.includes('text/event-stream')

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let closed = false

  const pingInterval = setInterval(() => {
    if (closed) return
    try {
      res.write(': ping\n\n')
    } catch {
      void 0
    }
  }, 10_000)

  const close = async () => {
    if (closed) return
    closed = true
    clearInterval(pingInterval)
    try {
      await reader.cancel()
    } catch {
      void 0
    }
  }

  req.on('close', () => {
    void close()
  })

  try {
    while (!closed) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })

      if (isEventStream) {
        if (chunk) res.write(chunk)
        continue
      }

      if (chunk) {
        const payload = JSON.stringify({ type: 'content', content: chunk })
        res.write(`data: ${payload}\n\n`)
      }
    }

    if (!isEventStream) {
      res.write(`data: ${JSON.stringify({ type: 'end', status: 'success' })}\n\n`)
    }
  } catch {
    void 0
  } finally {
    await close()
    res.end()
  }
})

export default router
