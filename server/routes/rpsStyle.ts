import { Router, type Request, type Response } from 'express'
import {
  getRpsCustomQuery,
  getRpsStyleMatrix,
  getRpsStylePanel,
  getRpsStyleSeries,
  getRpsStyleSummary,
  getRpsStyleSupportedTickers,
  getRpsStyleTurnoverHistory,
  getRpsStyleTurnoverSummary,
  getRpsStyleTurnoverSupportedTickers,
  normalizeRpsCustomTickerInput,
} from '../lib/rpsStyle.js'
import { listRpsCustomRecentSearches, recordRpsCustomRecentSearch } from '../lib/rpsRecentSearches.js'
import { getCookie, verifySessionToken } from '../lib/session.js'

const router = Router()

function getRpsRecentSearchUserKey(req: Request): string | null {
  const secret = String(process.env.AUTH_SESSION_SECRET || process.env.ADMIN_ACCESS_TOKEN || process.env.ADMIN_TOKEN || '').trim()
  if (!secret) return null
  const token = getCookie(req, 'etf_session')
  if (!token) return null
  const verified = verifySessionToken(secret, token)
  return verified.ok ? verified.username : null
}

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

router.get('/custom-query', async (req: Request, res: Response) => {
  const ticker = typeof req.query.ticker === 'string' ? req.query.ticker.trim() : ''
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined
  if (!ticker) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ success: false, error: 'bad_request', message: '请输入ETF代码' })
    return
  }
  try {
    normalizeRpsCustomTickerInput(ticker)
    const out = await getRpsCustomQuery({ ticker, startDate, endDate })
    const userKey = getRpsRecentSearchUserKey(req)
    if (userKey) {
      await recordRpsCustomRecentSearch(userKey, {
        ticker: out.data.ticker,
        code: out.data.code,
        name: out.data.name,
      })
    }
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ success: true, ...out })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    res.setHeader('Cache-Control', 'no-store')
    if (message.startsWith('bad_request:')) {
      res.status(400).json({ success: false, error: 'bad_request', message: message.slice('bad_request:'.length) })
      return
    }
    if (message.startsWith('no_data:')) {
      res.status(404).json({ success: false, error: 'not_found', message: message.slice('no_data:'.length) })
      return
    }
    res.status(502).json({ success: false, error: 'upstream_error', message })
  }
})

router.get('/custom-query/recent-searches', async (req: Request, res: Response) => {
  try {
    const userKey = getRpsRecentSearchUserKey(req)
    const items = userKey ? await listRpsCustomRecentSearches(userKey) : []
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      success: true,
      data: {
        items,
      },
    })
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
