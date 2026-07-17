import { apiUrl } from '@/utils/apiBase'

export type ManagedAuthUser = {
  username: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  forcePasswordChange: boolean
  passwordChangedAt: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data?: T
}

type AdminUserWire = {
  username: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
  forcePasswordChange?: boolean
  mustChangePassword?: boolean
  passwordChangedAt?: string | null
  lastLoginAt?: string | null
  createdAt?: string
  updatedAt?: string
}

async function readJson<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | null
}

function getErrorMessage(payload: { message?: string } | null, response: Response): string {
  return payload?.message || `HTTP ${response.status}`
}

function mapManagedAuthUser(user: AdminUserWire): ManagedAuthUser {
  return {
    username: user.username,
    role: user.role,
    status: user.status,
    forcePasswordChange: user.forcePasswordChange === true || user.mustChangePassword === true,
    passwordChangedAt: user.passwordChangedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
  }
}

export async function fetchAdminUsers(): Promise<ManagedAuthUser[]> {
  const response = await fetch(apiUrl('/api/admin/users'), {
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await readJson<{ items: AdminUserWire[] }>(response)
  if (!response.ok || !payload?.success) {
    throw new Error(getErrorMessage(payload, response))
  }
  return Array.isArray(payload.data?.items) ? payload.data.items.map(mapManagedAuthUser) : []
}

export async function createAdminUser(input: {
  username: string
  role: 'admin' | 'user'
}): Promise<{ user: ManagedAuthUser; temporaryPassword: string }> {
  const response = await fetch(apiUrl('/api/admin/users'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const payload = await readJson<{ user: AdminUserWire; temporaryPassword: string }>(response)
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(getErrorMessage(payload, response))
  }
  return {
    user: mapManagedAuthUser(payload.data.user),
    temporaryPassword: payload.data.temporaryPassword,
  }
}

export async function resetAdminUserPassword(username: string): Promise<{ user: ManagedAuthUser; temporaryPassword: string }> {
  const response = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(username)}/reset-password`), {
    method: 'POST',
    credentials: 'include',
  })
  const payload = await readJson<{ user: AdminUserWire; temporaryPassword: string }>(response)
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(getErrorMessage(payload, response))
  }
  return {
    user: mapManagedAuthUser(payload.data.user),
    temporaryPassword: payload.data.temporaryPassword,
  }
}

export async function updateAdminUserStatus(input: {
  username: string
  status: 'active' | 'disabled'
}): Promise<ManagedAuthUser> {
  const response = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(input.username)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: input.status }),
  })
  const payload = await readJson<{ user: AdminUserWire }>(response)
  if (!response.ok || !payload?.success || !payload.data?.user) {
    throw new Error(getErrorMessage(payload, response))
  }
  return mapManagedAuthUser(payload.data.user)
}
