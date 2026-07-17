import { Router, type Request, type Response } from 'express'
import { ensureDefaultAdminUser, getManagedUserByUsername, updateManagedUser } from '../lib/authUsers.js'
import { requireAuthAccess, resolveRequestAuthSession, type RequestAuthSession } from '../lib/adminAuth.js'
import { hashPassword, validatePasswordStrength, verifyPassword } from '../lib/passwordAuth.js'
import { makeSessionToken, serializeCookie } from '../lib/session.js'

const router = Router()

function getClientIp(req: Request): string {
  const xfwd = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : ''
  const first = xfwd.split(',')[0]?.trim()
  const ip = first || (req.socket && typeof req.socket.remoteAddress === 'string' ? req.socket.remoteAddress : '')
  return ip || 'unknown'
}

const loginFail = new Map<string, { count: number; resetAt: number }>()
const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000
const LOGIN_FAILURE_LIMIT = 5
const SHORT_SESSION_TTL_MS = 12 * 60 * 60_000
const LONG_SESSION_TTL_MS = 7 * 24 * 60 * 60_000

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

function getFailKeys(ip: string, username: string): string[] {
  return [`ip:${ip}`, username ? `account:${username}` : ''].filter(Boolean)
}

function bumpFail(ip: string, username: string) {
  const now = Date.now()
  for (const key of getFailKeys(ip, username)) {
    const hit = loginFail.get(key)
    if (!hit || hit.resetAt < now) {
      loginFail.set(key, { count: 1, resetAt: now + LOGIN_FAILURE_WINDOW_MS })
      continue
    }
    hit.count += 1
    loginFail.set(key, hit)
  }
}

function tooManyFails(ip: string, username: string): boolean {
  const now = Date.now()
  return getFailKeys(ip, username).some((key) => {
    const hit = loginFail.get(key)
    if (!hit) return false
    if (hit.resetAt < now) return false
    return hit.count >= LOGIN_FAILURE_LIMIT
  })
}

function clearFails(ip: string, username: string) {
  for (const key of getFailKeys(ip, username)) {
    loginFail.delete(key)
  }
}

function getSessionSecretOrThrow(): string {
  const secret = String(process.env.AUTH_SESSION_SECRET || '').trim()
  if (!secret) throw new Error('missing env: AUTH_SESSION_SECRET')
  return secret
}

function buildSessionPayload(user: { username: string; role: 'admin' | 'user'; mustChangePassword: boolean; remember: boolean }) {
  return {
    username: user.username,
    role: user.role,
    forcePasswordChange: user.mustChangePassword,
    remember: user.remember,
  }
}

function buildSessionResponse(session: RequestAuthSession | { username: string; role: 'admin' | 'user'; forcePasswordChange: boolean; user: { status: string } }) {
  return {
    authenticated: true,
    username: session.username,
    role: session.role,
    forcePasswordChange: session.forcePasswordChange,
    mustChangePassword: session.forcePasswordChange,
    status: session.user.status,
  }
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req)
  const body = (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}) as Record<string, unknown>
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const remember = Boolean(body.remember)

  if (tooManyFails(ip, username)) {
    res.status(429).json({ success: false, error: 'rate_limited', message: '登录失败次数过多，请稍后再试' })
    return
  }

  if (!username || !password) {
    bumpFail(ip, username)
    res.status(400).json({ success: false, error: 'bad_request', message: '请输入账号和密码' })
    return
  }

  try {
    await ensureDefaultAdminUser()
    const user = await getManagedUserByUsername(username).catch(() => null)
    if (!user || user.status !== 'active') {
      bumpFail(ip, username)
      res.status(401).json({ success: false, error: 'unauthorized', message: '账号或密码错误，请重试' })
      return
    }
    const passwordOk = await verifyPassword(password, user.passwordHash)
    if (!passwordOk) {
      bumpFail(ip, username)
      res.status(401).json({ success: false, error: 'unauthorized', message: '账号或密码错误，请重试' })
      return
    }
    clearFails(ip, username)
    const sessionSecret = getSessionSecretOrThrow()
    const ttlMs = remember ? LONG_SESSION_TTL_MS : SHORT_SESSION_TTL_MS
    const updatedUser = await updateManagedUser({
      username: user.username,
      lastLoginAt: new Date().toISOString(),
    })
    const token = makeSessionToken(
      sessionSecret,
      buildSessionPayload({
        username: updatedUser.username,
        role: updatedUser.role,
        mustChangePassword: updatedUser.mustChangePassword,
        remember,
      }),
      ttlMs,
    )
    const secure = Boolean(process.env.VERCEL)
    const maxAgeSeconds = remember ? LONG_SESSION_TTL_MS / 1000 : undefined
    res.setHeader(
      'Set-Cookie',
      serializeCookie('etf_session', token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAgeSeconds }),
    )
    res.status(200).json({
      success: true,
      session: buildSessionResponse({
        username: updatedUser.username,
        role: updatedUser.role,
        forcePasswordChange: updatedUser.mustChangePassword,
        user: { status: updatedUser.status },
      }),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  void req
  clearSessionCookie(res)
  res.status(200).json({ success: true })
})

router.get('/me', async (req: Request, res: Response) => {
  try {
    const session = await resolveRequestAuthSession(req)
    if (!session) {
      clearSessionCookie(res)
      res.status(200).json({ authenticated: false })
      return
    }
    res.status(200).json(buildSessionResponse(session))
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

router.post('/change-password', requireAuthAccess({ allowPasswordChangeRequired: true }), async (req: Request, res: Response): Promise<void> => {
  const authSession = res.locals.authSession as RequestAuthSession | undefined
  const body = (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}) as Record<string, unknown>
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!authSession?.username) {
    res.status(401).json({ success: false, error: 'unauthorized', message: '请先登录' })
    return
  }
  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'bad_request', message: '请完整填写密码信息' })
    return
  }
  const strengthError = validatePasswordStrength(newPassword)
  if (strengthError) {
    res.status(400).json({ success: false, error: 'bad_request', message: strengthError })
    return
  }

  try {
    const user = await getManagedUserByUsername(authSession.username)
    if (!user || user.status !== 'active') {
      clearSessionCookie(res)
      res.status(401).json({ success: false, error: 'unauthorized', message: '登录状态已失效，请重新登录' })
      return
    }
    const currentPasswordOk = await verifyPassword(currentPassword, user.passwordHash)
    if (!currentPasswordOk) {
      res.status(400).json({ success: false, error: 'bad_request', message: '当前密码不正确' })
      return
    }
    const sameAsCurrent = await verifyPassword(newPassword, user.passwordHash)
    if (sameAsCurrent) {
      res.status(400).json({ success: false, error: 'bad_request', message: '新密码不能与当前密码相同' })
      return
    }
    const passwordHash = await hashPassword(newPassword)
    const updatedUser = await updateManagedUser({
      username: user.username,
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date().toISOString(),
    })
    const sessionSecret = getSessionSecretOrThrow()
    const remainingTtlMs = Math.max(60_000, authSession.expiresAt - Date.now())
    const remember = authSession.remember
    const token = makeSessionToken(
      sessionSecret,
      buildSessionPayload({
        username: updatedUser.username,
        role: updatedUser.role,
        mustChangePassword: false,
        remember,
      }),
      remainingTtlMs,
    )
    const secure = Boolean(process.env.VERCEL)
    res.setHeader(
      'Set-Cookie',
      serializeCookie('etf_session', token, {
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        path: '/',
        maxAgeSeconds: remember ? Math.ceil(remainingTtlMs / 1000) : undefined,
      }),
    )
    res.status(200).json({
      success: true,
      session: buildSessionResponse({
        username: updatedUser.username,
        role: updatedUser.role,
        forcePasswordChange: false,
        user: { status: updatedUser.status },
      }),
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
export default router
