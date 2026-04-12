import { Menu } from 'lucide-react'

export default function NavBar({
  username,
  onOpenMenu,
  onLogout,
}: {
  username?: string | null
  onOpenMenu?: () => void
  onLogout?: () => void
}) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.60)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-3">
          {onOpenMenu ? (
            <button
              type="button"
              onClick={onOpenMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#E6EDF7] transition hover:border-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50 md:hidden"
              aria-label="打开菜单"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          <img src="/figma/login/login_logo.svg" alt="" className="h-7 w-7 select-none" aria-hidden="true" />
          <div className="text-xs font-black uppercase tracking-[0.12em] text-white sm:text-sm">
            ETF MONITOR <span className="text-[#FF5722]">AI</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {username ? (
            <div className="hidden text-xs text-[#A9B6CC] sm:block">
              当前账户： <span className="font-mono text-[#E6EDF7]">{username}</span>
            </div>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[rgba(255,87,34,0.55)] bg-transparent px-4 text-xs font-semibold text-[#FF5722] transition hover:bg-[rgba(255,87,34,0.08)]"
            >
              <img src="/figma/list/logout_icon.svg" alt="" className="h-4 w-4 select-none" aria-hidden="true" />
              退出登录
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
