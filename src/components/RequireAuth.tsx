import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '@/utils/apiBase'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { cache: 'no-store', credentials: 'include' })
        const j = (await res.json().catch(() => null)) as unknown
        const authed = Boolean(j && typeof j === 'object' && (j as Record<string, unknown>).authenticated === true)
        if (!authed) {
          const next = loc.pathname + (loc.search || '')
          nav(`/login?next=${encodeURIComponent(next)}`, { replace: true })
          return
        }
        setOk(true)
      } catch {
        const next = loc.pathname + (loc.search || '')
        nav(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      }
    })()
  }, [loc.pathname, loc.search, nav])

  if (ok !== true) return null
  return <>{children}</>
}

