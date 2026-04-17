import { apiUrl } from '@/utils/apiBase'

export type AuthSession = {
  authenticated: boolean
  username: string | null
}

const AUTH_SESSION_TTL_MS = 2500

let cachedSession: AuthSession | null = null
let cachedAt = 0
let inflight: Promise<AuthSession> | null = null

function parseAuthSession(payload: unknown): AuthSession {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const authenticated = Boolean(obj?.authenticated === true)
  const username = authenticated ? String(obj?.username || '').trim() || null : null
  return { authenticated, username }
}

async function fetchAuthSession(): Promise<AuthSession> {
  const res = await fetch(apiUrl('/api/auth/me'), { cache: 'no-store', credentials: 'include' })
  const json = (await res.json().catch(() => null)) as unknown
  const session = parseAuthSession(json)
  cachedSession = session
  cachedAt = Date.now()
  return session
}

export async function getAuthSession(options?: { forceRefresh?: boolean }): Promise<AuthSession> {
  const now = Date.now()
  const forceRefresh = options?.forceRefresh === true

  if (!forceRefresh && cachedSession && now - cachedAt <= AUTH_SESSION_TTL_MS) {
    return cachedSession
  }

  if (inflight) {
    return inflight
  }

  inflight = fetchAuthSession().finally(() => {
    inflight = null
  })

  return inflight
}

export function getCachedAuthSession(): AuthSession | null {
  if (!cachedSession) return null
  if (Date.now() - cachedAt > AUTH_SESSION_TTL_MS) return null
  return cachedSession
}

export function setCachedAuthSession(session: AuthSession): void {
  cachedSession = session
  cachedAt = Date.now()
}

export function clearCachedAuthSession(): void {
  cachedSession = null
  cachedAt = 0
  inflight = null
}
