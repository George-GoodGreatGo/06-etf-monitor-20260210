import { generateTemporaryPassword, hashPassword } from './passwordAuth.js'

export type AuthRole = 'admin' | 'user'
export type AuthStatus = 'active' | 'disabled'

export type ManagedAuthUser = {
  username: string
  role: AuthRole
  status: AuthStatus
  passwordHash: string
  mustChangePassword: boolean
  passwordChangedAt: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type SafeManagedAuthUser = Omit<ManagedAuthUser, 'passwordHash'>

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/
const DEFAULT_ADMIN_USERNAME = 'gzliyuxin'
const DEFAULT_ADMIN_PASSWORD = 'Goodgoodmoney6789@'

let ensureSeedPromise: Promise<void> | null = null

function mustEnv(name: string): string {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`missing env: ${name}`)
  return value
}

function authTableBaseUrl(): string {
  return `${mustEnv('SUPABASE_URL').replace(/\/+$/, '')}/rest/v1/auth_user_account`
}

function serviceHeaders(extra?: Record<string, string>): HeadersInit {
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  }
}

function mapManagedUser(row: unknown): ManagedAuthUser | null {
  if (!row || typeof row !== 'object') return null
  const value = row as Record<string, unknown>
  const username = typeof value.username === 'string' ? value.username : ''
  const role = value.role === 'admin' ? 'admin' : value.role === 'user' ? 'user' : null
  const status = value.status === 'disabled' ? 'disabled' : value.status === 'active' ? 'active' : null
  const passwordHash = typeof value.password_hash === 'string' ? value.password_hash : ''
  const mustChangePassword = value.must_change_password === true
  const createdAt = typeof value.created_at === 'string' ? value.created_at : ''
  const updatedAt = typeof value.updated_at === 'string' ? value.updated_at : ''
  if (!username || !role || !status || !passwordHash || !createdAt || !updatedAt) return null
  return {
    username,
    role,
    status,
    passwordHash,
    mustChangePassword,
    passwordChangedAt: typeof value.password_changed_at === 'string' ? value.password_changed_at : null,
    lastLoginAt: typeof value.last_login_at === 'string' ? value.last_login_at : null,
    createdAt,
    updatedAt,
  }
}

function firstRow(json: unknown): ManagedAuthUser | null {
  if (!Array.isArray(json) || json.length === 0) return null
  return mapManagedUser(json[0])
}

export function sanitizeUsername(input: string): string {
  const username = String(input || '').trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('账号格式不合法，仅支持 3-32 位小写字母、数字、点、下划线、中划线')
  }
  return username
}

export function toSafeManagedUser(user: ManagedAuthUser): SafeManagedAuthUser {
  const { passwordHash, ...rest } = user
  void passwordHash
  return rest
}

export async function getManagedUserByUsername(usernameRaw: string): Promise<ManagedAuthUser | null> {
  const username = sanitizeUsername(usernameRaw)
  const url = `${authTableBaseUrl()}?username=eq.${encodeURIComponent(username)}&select=*`
  const res = await fetch(url, { headers: serviceHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`read auth_user_account failed: HTTP ${res.status} ${body}`)
  }
  const json = (await res.json().catch(() => null)) as unknown
  return firstRow(json)
}

export async function listManagedUsers(): Promise<ManagedAuthUser[]> {
  const url = `${authTableBaseUrl()}?select=*&order=role.desc,status.asc,username.asc`
  const res = await fetch(url, { headers: serviceHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`list auth_user_account failed: HTTP ${res.status} ${body}`)
  }
  const json = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(json)) return []
  return json.map((row) => mapManagedUser(row)).filter((row): row is ManagedAuthUser => Boolean(row))
}

export async function countActiveAdmins(): Promise<number> {
  const users = await listManagedUsers()
  return users.filter((user) => user.role === 'admin' && user.status === 'active').length
}

export async function createManagedUser(args: {
  username: string
  role: AuthRole
  status?: AuthStatus
  passwordHash: string
  mustChangePassword?: boolean
  passwordChangedAt?: string | null
  lastLoginAt?: string | null
}): Promise<ManagedAuthUser> {
  const username = sanitizeUsername(args.username)
  const now = new Date().toISOString()
  const row = {
    username,
    role: args.role,
    status: args.status ?? 'active',
    password_hash: String(args.passwordHash || '').trim(),
    must_change_password: args.mustChangePassword ?? true,
    password_changed_at: args.passwordChangedAt ?? null,
    last_login_at: args.lastLoginAt ?? null,
    created_at: now,
    updated_at: now,
  }
  const res = await fetch(authTableBaseUrl(), {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`create auth_user_account failed: HTTP ${res.status} ${body}`)
  }
  const json = (await res.json().catch(() => null)) as unknown
  const created = firstRow(json)
  if (!created) throw new Error('create auth_user_account failed: empty response')
  return created
}

export async function updateManagedUser(args: {
  username: string
  role?: AuthRole
  status?: AuthStatus
  passwordHash?: string
  mustChangePassword?: boolean
  passwordChangedAt?: string | null
  lastLoginAt?: string | null
}): Promise<ManagedAuthUser> {
  const username = sanitizeUsername(args.username)
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (args.role) patch.role = args.role
  if (args.status) patch.status = args.status
  if (args.passwordHash) patch.password_hash = String(args.passwordHash).trim()
  if (args.mustChangePassword != null) patch.must_change_password = args.mustChangePassword === true
  if (args.passwordChangedAt !== undefined) patch.password_changed_at = args.passwordChangedAt
  if (args.lastLoginAt !== undefined) patch.last_login_at = args.lastLoginAt
  const url = `${authTableBaseUrl()}?username=eq.${encodeURIComponent(username)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`update auth_user_account failed: HTTP ${res.status} ${body}`)
  }
  const json = (await res.json().catch(() => null)) as unknown
  const updated = firstRow(json)
  if (!updated) throw new Error('update auth_user_account failed: empty response')
  return updated
}

export async function ensureDefaultAdminUser(): Promise<void> {
  if (ensureSeedPromise) return await ensureSeedPromise
  ensureSeedPromise = (async () => {
    const activeAdmins = await countActiveAdmins()
    if (activeAdmins > 0) return
    const existingSeedUser = await getManagedUserByUsername(DEFAULT_ADMIN_USERNAME).catch(() => null)
    if (existingSeedUser?.role === 'admin') return
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD)
    try {
      await createManagedUser({
        username: DEFAULT_ADMIN_USERNAME,
        role: 'admin',
        status: 'active',
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: null,
        lastLoginAt: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/409|duplicate|23505/i.test(message)) throw error
    }
  })().finally(() => {
    ensureSeedPromise = null
  })
  return await ensureSeedPromise
}

export async function provisionManagedUser(args: {
  username: string
  role?: AuthRole
}): Promise<{ user: ManagedAuthUser; temporaryPassword: string }> {
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  const user = await createManagedUser({
    username: args.username,
    role: args.role ?? 'user',
    status: 'active',
    passwordHash,
    mustChangePassword: true,
    passwordChangedAt: null,
    lastLoginAt: null,
  })
  return { user, temporaryPassword }
}

export async function resetManagedUserPassword(username: string): Promise<{ user: ManagedAuthUser; temporaryPassword: string }> {
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  const user = await updateManagedUser({
    username,
    passwordHash,
    mustChangePassword: true,
    passwordChangedAt: null,
  })
  return { user, temporaryPassword }
}
