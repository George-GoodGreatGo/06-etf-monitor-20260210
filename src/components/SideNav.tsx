import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

type HomeTab = 'list' | 'insight' | 'liquidity' | 'lowvol'

const HOME_TABS: Array<{ tab: HomeTab; label: string }> = [
  { tab: 'list', label: 'ETF200 列表' },
  { tab: 'insight', label: 'AI 解读' },
  { tab: 'liquidity', label: '大盘看板' },
  { tab: 'lowvol', label: '低波机会' },
]

export default function SideNav({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [searchParams] = useSearchParams()

  const isHome = loc.pathname === '/'
  const rawTab = searchParams.get('tab')
  const tab: HomeTab =
    rawTab === 'list' || rawTab === 'insight' || rawTab === 'liquidity' || rawTab === 'lowvol' ? rawTab : 'list'

  return (
    <aside className={cn('shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.55)] backdrop-blur', className)}>
      <div className="flex h-full flex-col px-4 py-4">
        <div className="text-[11px] font-semibold tracking-wide text-[#94A3B8]">导航</div>
        <div className="mt-2 flex flex-1 flex-col gap-1 overflow-auto pr-1">
          {HOME_TABS.map((x) => {
            const active = isHome && tab === x.tab
            return (
              <button
                key={x.tab}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  next.set('tab', x.tab)
                  nav({ pathname: '/', search: `?${next.toString()}` })
                  onNavigate?.()
                }}
                className={cn(
                  'group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50',
                  active
                    ? 'bg-[rgba(255,87,34,0.12)] text-white shadow-[inset_0_0_0_1px_rgba(255,87,34,0.30)]'
                    : 'text-[#A9B6CC] hover:-translate-y-[1px] hover:bg-white/5 hover:text-white hover:shadow-[0_10px_30px_rgba(0,0,0,0.25)] active:translate-y-0',
                )}
              >
                <span>{x.label}</span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full bg-[#FF5722] transition-all duration-200',
                    active ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover:opacity-60 group-hover:scale-90',
                  )}
                  aria-hidden="true"
                />
              </button>
            )
          })}

          <NavLink
            to="/methodology"
            className={({ isActive }) =>
              cn(
                'group mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50',
                isActive
                  ? 'bg-[rgba(255,87,34,0.12)] text-white shadow-[inset_0_0_0_1px_rgba(255,87,34,0.30)]'
                  : 'text-[#A9B6CC] hover:-translate-y-[1px] hover:bg-white/5 hover:text-white hover:shadow-[0_10px_30px_rgba(0,0,0,0.25)] active:translate-y-0',
              )
            }
            onClick={() => onNavigate?.()}
          >
            <span>数据与方法</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5722] opacity-0 transition-opacity duration-200 group-hover:opacity-60" aria-hidden="true" />
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
