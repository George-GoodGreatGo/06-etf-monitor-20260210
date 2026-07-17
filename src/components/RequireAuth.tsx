import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAuthSession, getCachedAuthSession } from '@/utils/authSession'

export default function RequireAuth({
  children,
  allowPasswordChangeRequired,
  adminOnly,
}: {
  children: React.ReactNode
  allowPasswordChangeRequired?: boolean
  adminOnly?: boolean
}) {
  const [ok, setOk] = useState<boolean | null>(() => {
    const cached = getCachedAuthSession()
    if (cached?.authenticated !== true) return null
    if (!allowPasswordChangeRequired && cached.forcePasswordChange) return null
    if (adminOnly && cached.role !== 'admin') return null
    return true
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
        if (!allowPasswordChangeRequired && session.forcePasswordChange) {
          const next = loc.pathname + (loc.search || '')
          nav(`/change-password?next=${encodeURIComponent(next)}`, { replace: true })
          return
        }
        if (adminOnly && session.role !== 'admin') {
          nav('/', { replace: true })
          return
        }
        setOk(true)
      } catch {
        const next = loc.pathname + (loc.search || '')
        nav(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      }
    })()
  }, [adminOnly, allowPasswordChangeRequired, loc.pathname, loc.search, nav])

  if (ok !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050A0B] text-[#A9B6CC]">
        <div className="text-sm">正在检查登录状态...</div>
      </div>
    )
  }
  return <>{children}</>
}
