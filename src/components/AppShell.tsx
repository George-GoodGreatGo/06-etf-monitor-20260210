import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SideNav from '@/components/SideNav'
import { apiUrl } from '@/utils/apiBase'

export default function AppShell() {
  const nav = useNavigate()
  const [username, setUsername] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <div className="min-h-screen bg-[#050A0B] text-[#E6EDF7]">
      <NavBar
        username={username}
        onOpenMenu={() => setDrawerOpen(true)}
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

      <div className="hidden md:block">
        <SideNav className="fixed left-0 top-0 h-screen w-[240px] pt-[72px]" />
      </div>

      <div className="md:hidden">
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <SideNav
          className={`fixed left-0 top-0 z-50 h-screen w-[260px] pt-[72px] transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onNavigate={() => setDrawerOpen(false)}
        />
      </div>

      <div className="pt-[72px] md:pl-[240px]">
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-14 pt-6 sm:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
