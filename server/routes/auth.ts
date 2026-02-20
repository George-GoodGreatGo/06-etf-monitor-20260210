/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { getCookie, makeSessionToken, serializeCookie, verifySessionToken } from '../lib/session.js'

const router = Router()

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  void req
  res.status(501).json({
    success: false,
    error: 'not_implemented',
    message: 'Register is not supported',
  })
})

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

function getClientIp(req: Request): string {
  const xfwd = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : ''
  const first = xfwd.split(',')[0]?.trim()
  const ip = first || (req.socket && typeof req.socket.remoteAddress === 'string' ? req.socket.remoteAddress : '')
  return ip || 'unknown'
}

const loginFail = new Map<string, { count: number; resetAt: number }>()

function bumpFail(ip: string) {
  const now = Date.now()
  const ttl = 30 * 60_000
  const hit = loginFail.get(ip)
  if (!hit || hit.resetAt < now) {
    loginFail.set(ip, { count: 1, resetAt: now + ttl })
    return
  }
  hit.count += 1
  loginFail.set(ip, hit)
}

function tooManyFails(ip: string): boolean {
  const now = Date.now()
  const hit = loginFail.get(ip)
  if (!hit) return false
  if (hit.resetAt < now) return false
  return hit.count >= 20
}

function clearFails(ip: string) {
  loginFail.delete(ip)
}

function parseAllowedEmails(): Set<string> {
  const raw = String(process.env.AUTH_ALLOWED_EMAILS || '').trim()
  if (!raw) return new Set()
  try {
    const j = JSON.parse(raw) as unknown
    if (Array.isArray(j)) {
      return new Set(j.map((x) => String(x || '').trim().toLowerCase()).filter((x) => x))
    }
  } catch {
    void 0
  }
  return new Set(raw.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x))
}

router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req)
  if (tooManyFails(ip)) {
    res.status(429).json({ success: false, error: 'rate_limited', message: '尝试次数过多，请稍后再试' })
    return
  }

  let sessionSecret: string
  let clientId: string
  try {
    sessionSecret = mustEnv('AUTH_SESSION_SECRET')
    clientId = mustEnv('GOOGLE_CLIENT_ID')
  } catch (e) {
    res.status(500).json({ success: false, error: 'missing_env', message: e instanceof Error ? e.message : String(e) })
    return
  }

  const allowed = parseAllowedEmails()
  if (allowed.size === 0) {
    res.status(500).json({ success: false, error: 'missing_allowlist', message: '未配置 AUTH_ALLOWED_EMAILS' })
    return
  }

  const body = (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >
  const credential = typeof body.credential === 'string' ? body.credential.trim() : ''
  const remember = Boolean(body.remember)
  if (!credential) {
    bumpFail(ip)
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 credential' })
    return
  }

  const client = new OAuth2Client()
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
    const payload = ticket.getPayload()
    const email = payload?.email ? String(payload.email).trim().toLowerCase() : ''
    const verified = payload?.email_verified === true
    if (!email || !verified) {
      bumpFail(ip)
      res.status(401).json({ success: false, error: 'unauthorized', message: 'Google 邮箱未验证' })
      return
    }
    if (!allowed.has(email)) {
      bumpFail(ip)
      res.status(403).json({ success: false, error: 'forbidden', message: '该邮箱不在白名单中' })
      return
    }

    clearFails(ip)
    const ttlMs = remember ? 7 * 24 * 60 * 60_000 : 12 * 60 * 60_000
    const token = makeSessionToken(sessionSecret, email, ttlMs)
    const secure = Boolean(process.env.VERCEL)
    const maxAgeSeconds = remember ? 7 * 24 * 60 * 60 : undefined
    res.setHeader(
      'Set-Cookie',
      serializeCookie('etf_session', token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAgeSeconds }),
    )
    res.status(200).json({ success: true, username: email })
  } catch {
    bumpFail(ip)
    res.status(401).json({ success: false, error: 'unauthorized', message: 'Google 登录验证失败' })
  }
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  void req
  const secure = Boolean(process.env.VERCEL)
  res.setHeader(
    'Set-Cookie',
    serializeCookie('etf_session', '', { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAgeSeconds: 0 }),
  )
  res.status(200).json({ success: true })
})

router.get('/me', (req: Request, res: Response) => {
  let secret = String(process.env.AUTH_SESSION_SECRET || '').trim()
  if (!secret) secret = String(process.env.ADMIN_ACCESS_TOKEN || '').trim()
  if (!secret) {
    res.status(200).json({ authenticated: false })
    return
  }
  const token = getCookie(req, 'etf_session')
  if (!token) {
    res.status(200).json({ authenticated: false })
    return
  }
  const v = verifySessionToken(secret, token)
  if (!v.ok) {
    res.status(200).json({ authenticated: false })
    return
  }
  res.status(200).json({ authenticated: true, username: v.username })
})
export default router
