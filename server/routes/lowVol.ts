import { Router, type Request, type Response } from 'express'
import { getLowVolH30269Series } from '../lib/lowVol.js'

const router = Router()

router.get('/h30269', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
    const out = await getLowVolH30269Series({ startDate, endDate })
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    res.status(502).json({ success: false, error: e instanceof Error ? e.message : String(e) })
  }
})

export default router

