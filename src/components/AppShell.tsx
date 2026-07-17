import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import SideNav from '@/components/SideNav'
import { apiUrl } from '@/utils/apiBase'
import { clearCachedAuthSession, getAuthSession, type AuthSession } from '@/utils/authSession'

const SIDEBAR_COLLAPSE_KEY = 'etf_monitor_sidebar_collapsed'

export default function AppShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isQuotesHome = loc.pathname === '/'

  useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      try {
        const currentSession = await getAuthSession({ forceRefresh: true })
        if (ac.signal.aborted) return
        setSession(currentSession)
      } catch {
        setSession(null)
      }
    })()
    return () => ac.abort()
  }, [loc.pathname])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
      setSidebarCollapsed(raw === '1')
    } catch {
      setSidebarCollapsed(false)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? '1' : '0')
    } catch {
      void 0
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <div
      className="min-h-screen bg-[#050A0B] text-[#E6EDF7]"
      style={
        {
          ['--sidebar-w' as string]: sidebarCollapsed ? '72px' : '240px',
        } as React.CSSProperties
      }
    >
      <NavBar
        username={session?.username}
        role={session?.role}
        onOpenMenu={() => setDrawerOpen(true)}
        onLogout={() => {
          void (async () => {
            try {
              await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                credentials: 'include',
              })
            } catch {
              void 0
            } finally {
              clearCachedAuthSession()
              nav(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true })
            }
          })()
        }}
      />

      <div className="hidden md:block">
        <SideNav
          className="fixed left-0 top-0 h-screen w-[var(--sidebar-w)] pt-[72px] transition-[width] duration-200 ease-out"
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          role={session?.role}
        />
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
          collapsed={false}
          role={session?.role}
        />
      </div>

      <div className="pt-[72px] md:pl-[var(--sidebar-w)] transition-[padding] duration-200 ease-out">
        <div className={isQuotesHome ? 'mx-auto w-full max-w-none px-0 pb-0 pt-0' : 'mx-auto w-full max-w-[1440px] px-4 pb-14 pt-6 sm:px-8'}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
