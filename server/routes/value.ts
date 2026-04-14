import { Router, type Request, type Response } from 'express'
import { getValueTimingIndexSnapshotSeries, getValueTimingSupportedIndexCodes, getValueTimingSummary } from '../lib/valueTiming.js'

const router = Router()

router.get('/index/:code', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const code = typeof req.params.code === 'string' ? req.params.code.trim() : ''
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    if (!code || !getValueTimingSupportedIndexCodes().includes(code)) {
      res.status(400).json({ success: false, error: 'bad_request', message: `不支持的指数 code：${code}` })
      return
    }
    const out = await getValueTimingIndexSnapshotSeries({ code, startDate, endDate })
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/summary', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const out = await getValueTimingSummary()
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

export default router

