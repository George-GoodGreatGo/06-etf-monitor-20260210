export function apiUrl(path: string): string {
  const base = (import.meta as unknown as { env?: Record<string, unknown> }).env
  const raw = base && typeof base.VITE_API_BASE_URL === 'string' ? base.VITE_API_BASE_URL : ''
  const apiBase = String(raw || '').trim().replace(/\/+$/, '')
  if (!apiBase) return path
  if (!path.startsWith('/')) return `${apiBase}/${path}`
  return `${apiBase}${path}`
}

