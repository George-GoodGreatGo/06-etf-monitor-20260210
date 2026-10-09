/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import compression from 'compression'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import etfRoutes from './routes/etf.js'
import adminRoutes from './routes/admin.js'
import aiRoutes from './routes/ai.js'
import lowVolRoutes from './routes/lowVol.js'
import marketRoutes from './routes/market.js'
import valueRoutes from './routes/value.js'
import rpsStyleRoutes from './routes/rpsStyle.js'
import usMarketStyleRoutes from './routes/usMarketStyle.js'
import { serverBootId, serverStartedAt } from './lib/runtime.js'
import { requireAdminAccess, requireAuthenticatedAccess } from './lib/adminAuth.js'
import { ensureDefaultAdminUser } from './lib/authUsers.js'

// load env
dotenv.config()
void ensureDefaultAdminUser()

const app: express.Application = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/etf', requireAuthenticatedAccess, etfRoutes)
app.use('/api/admin', requireAdminAccess, adminRoutes)
app.use('/api/ai', requireAuthenticatedAccess, aiRoutes)
app.use('/api/market', requireAuthenticatedAccess, marketRoutes)
app.use('/api/lowvol', requireAuthenticatedAccess, lowVolRoutes)
app.use('/api/value', requireAuthenticatedAccess, valueRoutes)
app.use('/api/rps', requireAuthenticatedAccess, rpsStyleRoutes)
app.use('/api/us-market-style', requireAuthenticatedAccess, usMarketStyleRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      serverBootId,
      serverStartedAt,
      isVercel: Boolean(process.env.VERCEL),
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  void req
  void next
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
