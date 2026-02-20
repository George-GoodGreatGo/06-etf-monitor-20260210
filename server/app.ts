/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import etfRoutes from './routes/etf.js'
import adminRoutes from './routes/admin.js'
import aiRoutes from './routes/ai.js'
import { serverBootId, serverStartedAt } from './lib/runtime.js'
import { requireAdminAccess } from './lib/adminAuth.js'

// load env
dotenv.config()

const app: express.Application = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/etf', requireAdminAccess, etfRoutes)
app.use('/api/admin', requireAdminAccess, adminRoutes)
app.use('/api/ai', requireAdminAccess, aiRoutes)

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
