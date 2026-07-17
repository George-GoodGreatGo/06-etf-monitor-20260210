import type { NextFunction, Request, RequestHandler, Response } from 'express'
import {
  ensureDefaultAdminUser,
  getManagedUserByUsername,
  toSafeManagedUser,
  type AuthRole,
  type SafeManagedAuthUser,
} from './authUsers.js'
import { getCookie, serializeCookie, verifySessionToken } from './session.js'

export type RequestAuthSession = {
  username: string
  role: AuthRole
  forcePasswordChange: boolean
  remember: boolean
  expiresAt: number
  user: SafeManagedAuthUser
}

function getSessionSecret(): string {
  return String(process.env.AUTH_SESSION_SECRET || '').trim()
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    serializeCookie('etf_session', '', {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: 0,
    }),
  )
}

export async function resolveRequestAuthSession(req: Request): Promise<RequestAuthSession | null> {
  await ensureDefaultAdminUser()
  const secret = getSessionSecret()
  if (!secret) return null
  const token = getCookie(req, 'etf_session')
  if (!token) return null
  const verified = verifySessionToken(secret, token)
  if (!verified.ok) return null
  const user = await getManagedUserByUsername(verified.session.username)
  if (!user || user.status !== 'active') return null
  return {
    username: user.username,
    role: user.role,
    forcePasswordChange: user.mustChangePassword,
    remember: verified.session.remember,
    expiresAt: verified.session.expiresAt,
    user: toSafeManagedUser(user),
  }
}

export function requireAuthAccess(options?: {
  requireAdmin?: boolean
  allowPasswordChangeRequired?: boolean
}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await resolveRequestAuthSession(req)
      if (!session) {
        clearSessionCookie(res)
        res.status(401).json({
          success: false,
          error: 'unauthorized',
          message: '请先登录',
        })
        return
      }
      if (options?.requireAdmin && session.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'forbidden',
          message: '仅管理员可访问',
        })
        return
      }
      if (!options?.allowPasswordChangeRequired && session.forcePasswordChange) {
        res.status(403).json({
          success: false,
          error: 'password_change_required',
          message: '请先完成密码修改',
        })
        return
      }
      res.locals.authSession = session
      next()
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export const requireAdminAccess = requireAuthAccess({ requireAdmin: true })
export const requireAuthenticatedAccess = requireAuthAccess()
