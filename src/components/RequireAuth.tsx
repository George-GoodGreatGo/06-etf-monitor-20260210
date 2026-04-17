import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAuthSession, getCachedAuthSession } from '@/utils/authSession'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(() => {
    const cached = getCachedAuthSession()
    return cached?.authenticated === true ? true : null
  })
  const nav = useNavigate()
  const loc = useLocation()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      try {
        const session = await getAuthSession()
        if (!session.authenticated) {
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

  if (ok !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050A0B] text-[#A9B6CC]">
        <div className="text-sm">正在检查登录状态...</div>
      </div>
    )
  }
  return <>{children}</>
}
