import { Router, type Request, type Response } from 'express'
import { getRpsStyleMatrix, getRpsStyleSeries, getRpsStyleSummary, getRpsStyleSupportedTickers } from '../lib/rpsStyle.js'

const router = Router()

router.get('/summary', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const out = await getRpsStyleSummary()
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/matrix', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    const out = await getRpsStyleMatrix({ startDate, endDate })
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/series/:ticker', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const ticker = typeof req.params.ticker === 'string' ? req.params.ticker.trim().toUpperCase() : ''
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    if (!ticker || !getRpsStyleSupportedTickers().includes(ticker)) {
      res.status(400).json({ success: false, error: 'bad_request', message: `不支持的ticker：${ticker}` })
      return
    }
    const out = await getRpsStyleSeries({ ticker, startDate, endDate })
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

export default router
