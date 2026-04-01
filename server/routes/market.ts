import express, { type Request, type Response } from 'express'
import { getMarketLiquidityV5 } from '../lib/marketLiquidityV5Service.js'

const router = express.Router()

router.get('/liquidity/v5', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    const out = await getMarketLiquidityV5({ startDate, endDate })
    res.status(200).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ success: false, error: 'upstream_error', message: msg || '数据源调用失败' })
  }
})

export default router
