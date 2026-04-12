import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

type HomeTab = 'list' | 'insight' | 'liquidity' | 'lowvol'

const HOME_TABS: Array<{ tab: HomeTab; label: string }> = [
  { tab: 'list', label: 'ETF200 列表' },
  { tab: 'insight', label: 'AI 解读' },
  { tab: 'liquidity', label: '大盘看板' },
  { tab: 'lowvol', label: '低波机会' },
]

export default function SideNav() {
  const nav = useNavigate()
  const loc = useLocation()
  const [searchParams] = useSearchParams()

  const isHome = loc.pathname === '/'
  const rawTab = searchParams.get('tab')
  const tab: HomeTab =
    rawTab === 'list' || rawTab === 'insight' || rawTab === 'liquidity' || rawTab === 'lowvol' ? rawTab : 'list'

  return (
    <aside className="w-[220px] shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.55)] backdrop-blur">
      <div className="px-4 py-4">
        <div className="text-[11px] font-semibold tracking-wide text-[#94A3B8]">导航</div>
        <div className="mt-2 flex flex-col gap-1">
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
                }}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition',
                  active
                    ? 'bg-[rgba(255,87,34,0.12)] text-white shadow-[inset_0_0_0_1px_rgba(255,87,34,0.30)]'
                    : 'text-[#A9B6CC] hover:bg-white/5 hover:text-white',
                )}
              >
                <span>{x.label}</span>
                {active ? <span className="h-1.5 w-1.5 rounded-full bg-[#FF5722]" /> : null}
              </button>
            )
          })}

          <NavLink
            to="/methodology"
            className={({ isActive }) =>
              cn(
                'mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition',
                isActive
                  ? 'bg-[rgba(255,87,34,0.12)] text-white shadow-[inset_0_0_0_1px_rgba(255,87,34,0.30)]'
                  : 'text-[#A9B6CC] hover:bg-white/5 hover:text-white',
              )
            }
          >
            <span>数据与方法</span>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}

