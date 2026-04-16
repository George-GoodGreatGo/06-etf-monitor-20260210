import { Router, type Request, type Response } from 'express'
import { getLowVolH30269Series, getLowVolIndexSnapshotSeries, getLowVolSupportedIndexCodes, getLowVolSummary } from '../lib/lowVol.js'

const router = Router()

router.get('/h30269', async (req: Request, res: Response) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    const out = await getLowVolH30269Series({ startDate, endDate })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('暂无快照')) {
      res.status(503).json({ success: false, error: 'no_snapshot', message: msg })
      return
    }
    res.status(502).json({ success: false, error: 'upstream_error', message: msg })
  }
})

router.get('/index/:code', async (req: Request, res: Response) => {
  try {
    const code = typeof req.params.code === 'string' ? req.params.code.trim() : ''
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    if (!code || !getLowVolSupportedIndexCodes().includes(code.toUpperCase())) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(400).json({ success: false, error: 'bad_request', message: `不支持的指数 code：${code}` })
      return
    }
    const out = await getLowVolIndexSnapshotSeries({ code, startDate, endDate })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const out = await getLowVolSummary()
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

export default router

