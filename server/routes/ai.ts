import express, { type Request, type Response } from 'express'
import { readTop100InsightByDataDate, readTop100LatestSnapshot } from '../lib/supabaseRest.js'
import { getTop100InsightGenerateStatus } from '../lib/top100Insight.js'

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

  const status = await getTop100InsightGenerateStatus(dataDate)
  res.status(200).json({
    success: true,
    data: {
      dataDate,
      status,
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

export default router
