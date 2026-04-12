import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SideNav from '@/components/SideNav'
import { apiUrl } from '@/utils/apiBase'

export default function AppShell() {
  const nav = useNavigate()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { cache: 'no-store', credentials: 'include', signal: ac.signal })
        const j = (await res.json().catch(() => null)) as unknown
        const u =
          j && typeof j === 'object' && (j as Record<string, unknown>).authenticated === true
            ? String((j as Record<string, unknown>).username || '').trim()
            : ''
        setUsername(u || null)
      } catch {
        setUsername(null)
      }
    })()
    return () => ac.abort()
  }, [])

  return (
    <div className="min-h-screen bg-[#050A0B] text-[#E6EDF7]">
      <NavBar
        username={username}
        onLogout={() => {
          void (async () => {
            try {
              ;(window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } })
                .google?.accounts?.id?.disableAutoSelect?.()
              await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                credentials: 'include',
              })
            } catch {
              void 0
            } finally {
              nav(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true })
            }
          })()
        }}
      />

      <div className="mx-auto flex w-full max-w-[1440px]">
        <SideNav />
        <main className="min-w-0 flex-1 px-8 pb-14 pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
