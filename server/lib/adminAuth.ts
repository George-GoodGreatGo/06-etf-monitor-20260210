import type { NextFunction, Request, Response } from 'express'

export function requireAdminAccess(req: Request, res: Response, next: NextFunction) {
  const token = String(process.env.ADMIN_ACCESS_TOKEN || '').trim()
  if (!token) {
    next()
    return
  }

  const headerTokenRaw =
    (typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : '') ||
    (typeof req.headers['x-access-token'] === 'string' ? req.headers['x-access-token'] : '')
  const headerToken = String(headerTokenRaw || '').trim()

  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''

  if (headerToken === token || bearer === token) {
    next()
    return
  }

  res.status(401).json({
    success: false,
    error: 'unauthorized',
    message: '需要管理员口令才能访问',
  })
}

