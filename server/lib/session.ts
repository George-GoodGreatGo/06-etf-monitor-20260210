import crypto from 'node:crypto'
import type { Request } from 'express'

type SessionPayload = {
  u: string
  r: 'admin' | 'user'
  f: boolean
  rm: boolean
  exp: number
  iat: number
  n: string
}

type CaptchaPayload = {
  a: number
  b: number
  op: '+' | '-'
  exp: number
  n: string
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  return Buffer.from(padded + '='.repeat(padLen), 'base64')
}

function sign(secret: string, data: string): string {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest())
}

function encodeSigned(secret: string, payload: unknown): string {
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf-8'))
  const sig = sign(secret, body)
  return `${body}.${sig}`
}

function decodeSigned(secret: string, token: string): unknown | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!body || !sig) return null
  const expected = sign(secret, body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  const ok = crypto.timingSafeEqual(a, b)
  if (!ok) return null
  try {
    return JSON.parse(base64UrlDecode(body).toString('utf-8')) as unknown
  } catch {
    return null
  }
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {}
  const parts = cookieHeader.split(';')
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx < 0) continue
    const k = p.slice(0, idx).trim()
    const v = p.slice(idx + 1).trim()
    if (!k) continue
    out[k] = v
  }
  return out
}

export function getCookie(req: Request, name: string): string | null {
  const h = typeof req.headers.cookie === 'string' ? req.headers.cookie : ''
  if (!h) return null
  const cookies = parseCookieHeader(h)
  const v = cookies[name]
  return typeof v === 'string' && v ? decodeURIComponent(v) : null
}

export type SessionIdentity = {
  username: string
  role: 'admin' | 'user'
  forcePasswordChange: boolean
  remember: boolean
}

export function makeSessionToken(secret: string, session: SessionIdentity, ttlMs: number): string {
  const now = Date.now()
  const payload: SessionPayload = {
    u: session.username,
    r: session.role,
    f: session.forcePasswordChange,
    rm: session.remember,
    iat: now,
    exp: now + ttlMs,
    n: crypto.randomUUID(),
  }
  return encodeSigned(secret, payload)
}

export function verifySessionToken(
  secret: string,
  token: string,
): { ok: true; session: SessionIdentity & { issuedAt: number; expiresAt: number } } | { ok: false } {
  const decoded = decodeSigned(secret, token)
  if (!decoded || typeof decoded !== 'object') return { ok: false }
  const o = decoded as Record<string, unknown>
  const u = typeof o.u === 'string' ? o.u : ''
  const r = o.r === 'admin' ? 'admin' : o.r === 'user' ? 'user' : null
  const f = o.f === true
  const rm = o.rm === true
  const exp = typeof o.exp === 'number' ? o.exp : 0
  const iat = typeof o.iat === 'number' ? o.iat : 0
  if (!u || !r || !exp || !iat) return { ok: false }
  if (Date.now() > exp) return { ok: false }
  return {
    ok: true,
    session: {
      username: u,
      role: r,
      forcePasswordChange: f,
      remember: rm,
      issuedAt: iat,
      expiresAt: exp,
    },
  }
}

export function makeCaptcha(secret: string): { token: string; question: string; exp: number } {
  const a = 10 + Math.floor(Math.random() * 90)
  const b = 1 + Math.floor(Math.random() * 9)
  const op: '+' | '-' = Math.random() > 0.5 ? '+' : '-'
  const now = Date.now()
  const exp = now + 3 * 60_000
  const payload: CaptchaPayload = { a, b, op, exp, n: crypto.randomUUID() }
  const token = encodeSigned(secret, payload)
  const question = op === '+' ? `${a} + ${b} = ?` : `${a} - ${b} = ?`
  return { token, question, exp }
}

export function verifyCaptcha(secret: string, token: string, answerRaw: string): boolean {
  const decoded = decodeSigned(secret, token)
  if (!decoded || typeof decoded !== 'object') return false
  const o = decoded as Record<string, unknown>
  const a = typeof o.a === 'number' ? o.a : null
  const b = typeof o.b === 'number' ? o.b : null
  const op = o.op === '+' || o.op === '-' ? (o.op as '+' | '-') : null
  const exp = typeof o.exp === 'number' ? o.exp : 0
  if (a == null || b == null || !op || !exp) return false
  if (Date.now() > exp) return false
  const answer = Number.parseInt(String(answerRaw || '').trim(), 10)
  if (!Number.isFinite(answer)) return false
  const expected = op === '+' ? a + b : a - b
  return answer === expected
}

export function serializeCookie(
  name: string,
  value: string,
  opts?: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
    maxAgeSeconds?: number
    path?: string
  },
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts?.path || '/'}`)
  if (opts?.maxAgeSeconds != null) parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`)
  if (opts?.httpOnly !== false) parts.push('HttpOnly')
  if (opts?.secure) parts.push('Secure')
  parts.push(`SameSite=${opts?.sameSite || 'Lax'}`)
  return parts.join('; ')
}
