import express, { type Request, type Response } from 'express'
import { getMarketLiquidityV5FromSupabase } from '../lib/marketBoardSupabaseService.js'

const router = express.Router()

router.get('/liquidity/v5', async (req: Request, res: Response) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    void req.query.forceRefresh
    const out = await getMarketLiquidityV5FromSupabase({ startDate, endDate })
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=120')
    res.status(200).json(out)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ success: false, error: 'upstream_error', message: msg || '数据源调用失败' })
  }
})

export default router
