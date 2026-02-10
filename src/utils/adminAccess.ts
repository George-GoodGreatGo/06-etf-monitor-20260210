const storageKey = 'etf_admin_access_token'

export function getAdminAccessToken(): string | null {
  try {
    const v = window.localStorage.getItem(storageKey)
    const t = String(v || '').trim()
    return t ? t : null
  } catch {
    return null
  }
}

export function setAdminAccessToken(token: string) {
  try {
    const t = String(token || '').trim()
    if (!t) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(storageKey, t)
  } catch {
    return
  }
}

export function adminAuthHeaders(): HeadersInit {
  const t = getAdminAccessToken()
  if (!t) return {}
  return {
    Authorization: `Bearer ${t}`,
  }
}

