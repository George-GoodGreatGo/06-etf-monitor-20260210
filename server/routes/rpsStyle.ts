import { Router, type Request, type Response } from 'express'
import {
  getRpsStyleMatrix,
  getRpsStylePanel,
  getRpsStyleSeries,
  getRpsStyleSummary,
  getRpsStyleSupportedTickers,
  getRpsStyleTurnoverHistory,
  getRpsStyleTurnoverSummary,
  getRpsStyleTurnoverSupportedTickers,
} from '../lib/rpsStyle.js'

const router = Router()

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const out = await getRpsStyleSummary()
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/matrix', async (req: Request, res: Response) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    const out = await getRpsStyleMatrix({ startDate, endDate })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/panel', async (req: Request, res: Response) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    const out = await getRpsStylePanel({ startDate, endDate })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/series/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = typeof req.params.ticker === 'string' ? req.params.ticker.trim().toUpperCase() : ''
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    if (!ticker || !getRpsStyleSupportedTickers().includes(ticker)) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(400).json({ success: false, error: 'bad_request', message: `不支持的ticker：${ticker}` })
      return
    }
    const out = await getRpsStyleSeries({ ticker, startDate, endDate })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/turnover-summary', async (_req: Request, res: Response) => {
  try {
    const out = await getRpsStyleTurnoverSummary()
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/turnover/:ticker', async (req: Request, res: Response) => {
  try {
    const ticker = typeof req.params.ticker === 'string' ? req.params.ticker.trim().toUpperCase() : ''
    if (!ticker || !getRpsStyleTurnoverSupportedTickers().includes(ticker)) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(400).json({ success: false, error: 'bad_request', message: `不支持的ticker：${ticker}` })
      return
    }
    const out = await getRpsStyleTurnoverHistory({ ticker })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ success: false, error: 'upstream_error', message: e instanceof Error ? e.message : String(e) })
  }
})

export default router
