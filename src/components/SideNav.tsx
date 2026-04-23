import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, BookOpen, ChevronLeft, ChevronRight, Home as HomeIcon, LineChart, List, Sparkles, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

type HomeTab = 'list' | 'insight' | 'liquidity' | 'lowvol' | 'value'

const HOME_TABS: Array<{ tab: HomeTab; label: string; icon: typeof List }> = [
  { tab: 'list', label: 'ETF200 列表', icon: List },
  { tab: 'insight', label: 'AI 解读', icon: Sparkles },
  { tab: 'liquidity', label: '大盘看板', icon: LineChart },
  { tab: 'lowvol', label: '低波机会', icon: Activity },
  { tab: 'value', label: '价值择时', icon: Target },
]

export default function SideNav({
  className,
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  className?: string
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const nav = useNavigate()
  const loc = useLocation()
  const [searchParams] = useSearchParams()

  const isHome = loc.pathname === '/'
  const isMarket = loc.pathname === '/market'
  const isRpsOverview = loc.pathname === '/market/rps'
  const isRpsCustomQuery = loc.pathname === '/market/rps/custom-query'
  const isRpsRoute = isRpsOverview || isRpsCustomQuery
  const isMethod = loc.pathname === '/methodology'
  const rawTab = isMarket ? searchParams.get('tab') : null
  const tab: HomeTab =
    rawTab === 'list' || rawTab === 'insight' || rawTab === 'liquidity' || rawTab === 'lowvol' || rawTab === 'value' ? rawTab : 'list'
  const collapsedValue = Boolean(collapsed)
  const activeKey = isMethod
    ? 'methodology'
    : isHome
      ? 'home'
      : isRpsRoute
        ? 'market-rps'
        : isMarket
          ? `market:${tab}`
          : ''

  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const [indicator, setIndicator] = useState<{ y: number; h: number; visible: boolean }>({ y: 0, h: 0, visible: false })

  const collapseTitle = collapsedValue ? '展开导航' : '折叠导航'

  const collapseBtn = useMemo(() => {
    if (!onToggleCollapse) return null
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          'group mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-[#A9B6CC] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
          collapsedValue ? 'px-0' : 'px-2',
        )}
        title={collapseTitle}
        aria-label={collapseTitle}
      >
        {collapsedValue ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {collapsedValue ? null : <span>{collapseTitle}</span>}
      </button>
    )
  }, [collapsedValue, collapseTitle, onToggleCollapse])

  useLayoutEffect(() => {
    const host = listRef.current
    if (!host) return
    const el = itemRefs.current[activeKey]
    if (!el) {
      setIndicator((v) => (v.visible ? { ...v, visible: false } : v))
      return
    }
    const raf = window.requestAnimationFrame(() => {
      const hostRect = host.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      setIndicator({ y: r.top - hostRect.top, h: r.height, visible: true })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [activeKey, collapsedValue])

  return (
    <aside className={cn('shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.55)] backdrop-blur', className)}>
      <div className="flex h-full flex-col px-4 py-4">
        <div className={cn('text-[11px] font-semibold tracking-wide text-[#94A3B8]', collapsedValue ? 'text-center' : '')}>
          导航
        </div>
        <div ref={listRef} className="relative mt-2 flex flex-1 flex-col gap-1 overflow-auto pr-1">
          <div
            className={cn(
              'pointer-events-none absolute left-0 right-1 rounded-lg border border-[rgba(255,87,34,0.26)] bg-[rgba(255,87,34,0.10)] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-[transform,height,opacity] duration-200 ease-out',
              indicator.visible ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              height: indicator.h,
              transform: `translateY(${indicator.y}px)`,
            }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => {
              nav('/')
              onNavigate?.()
            }}
            ref={(el) => {
              itemRefs.current['home'] = el
            }}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
              isHome
                ? 'bg-white/8 text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]'
                : 'text-[#A9B6CC] hover:bg-white/5 hover:text-white hover:shadow-[0_10px_26px_rgba(0,0,0,0.22)] active:scale-[0.99]',
              collapsedValue ? 'justify-start' : 'justify-between',
            )}
            title={collapsedValue ? '首页' : undefined}
            aria-label={collapsedValue ? '首页' : undefined}
          >
            <span className={cn('inline-flex items-center gap-3', collapsedValue ? 'justify-center' : 'min-w-0')}>
              <HomeIcon className={cn('h-4 w-4 shrink-0', isHome ? 'text-[#FF8A66]' : 'text-[#94A3B8] group-hover:text-[#E6EDF7]')} />
              {collapsedValue ? null : <span className="truncate">首页</span>}
            </span>
            {collapsedValue ? null : (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-[#FF5722] transition-all duration-200',
                  isHome ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover:opacity-60 group-hover:scale-90',
                )}
                aria-hidden="true"
              />
            )}
          </button>

          {HOME_TABS.map((x) => {
            const active = isMarket && tab === x.tab
            const Icon = x.icon
            return (
              <button
                key={x.tab}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  next.set('tab', x.tab)
                  nav({ pathname: '/market', search: `?${next.toString()}` })
                  onNavigate?.()
                }}
                ref={(el) => {
                  itemRefs.current[`market:${x.tab}`] = el
                }}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
                  active
                    ? 'bg-white/8 text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]'
                    : 'text-[#A9B6CC] hover:bg-white/5 hover:text-white hover:shadow-[0_10px_26px_rgba(0,0,0,0.22)] active:scale-[0.99]',
                  collapsedValue ? 'justify-start' : 'justify-between',
                )}
                title={collapsedValue ? x.label : undefined}
                aria-label={collapsedValue ? x.label : undefined}
              >
                <span className={cn('inline-flex items-center gap-3', collapsedValue ? 'justify-center' : 'min-w-0')}>
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#FF8A66]' : 'text-[#94A3B8] group-hover:text-[#E6EDF7]')} />
                  {collapsedValue ? null : <span className="truncate">{x.label}</span>}
                </span>
                {collapsedValue ? null : (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full bg-[#FF5722] transition-all duration-200',
                      active ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover:opacity-60 group-hover:scale-90',
                    )}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}

          <div className="mt-1 space-y-1">
            <button
              type="button"
              onClick={() => {
                nav('/market/rps')
                onNavigate?.()
              }}
              ref={(el) => {
                itemRefs.current['market-rps'] = el
              }}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
                isRpsRoute
                  ? 'bg-white/8 text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]'
                  : 'text-[#A9B6CC] hover:bg-white/5 hover:text-white hover:shadow-[0_10px_26px_rgba(0,0,0,0.22)] active:scale-[0.99]',
                collapsedValue ? 'justify-start' : 'justify-between',
              )}
              title={collapsedValue ? '市场风格RPS' : undefined}
              aria-label={collapsedValue ? '市场风格RPS' : undefined}
            >
              <span className={cn('inline-flex items-center gap-3', collapsedValue ? 'justify-center' : 'min-w-0')}>
                <LineChart className={cn('h-4 w-4 shrink-0', isRpsRoute ? 'text-[#FF8A66]' : 'text-[#94A3B8] group-hover:text-[#E6EDF7]')} />
                {collapsedValue ? null : <span className="truncate">市场风格RPS</span>}
              </span>
              {collapsedValue ? null : (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full bg-[#FF5722] transition-all duration-200',
                    isRpsRoute ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover:opacity-60 group-hover:scale-90',
                  )}
                  aria-hidden="true"
                />
              )}
            </button>

            {collapsedValue ? null : (
              <div className="ml-5 mr-1 space-y-1 border-l border-white/[0.07] pl-3">
                {[
                  { key: 'market-rps:overview', label: '总览', to: '/market/rps', active: isRpsOverview },
                  { key: 'market-rps:custom-query', label: '自定义查询', to: '/market/rps/custom-query', active: isRpsCustomQuery },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      nav(item.to)
                      onNavigate?.()
                    }}
                    ref={(el) => {
                      itemRefs.current[item.key] = el
                    }}
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium leading-5 transition-[color,background-color] duration-200 ease-out focus:outline-none focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
                      item.active
                        ? 'bg-white/[0.055] text-[#F3F7FD]'
                        : 'text-[#91A0B5] hover:bg-white/[0.035] hover:text-[#E6EDF7] active:bg-white/[0.045]',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200 ease-out',
                        item.active
                          ? 'bg-[#FF8A66]'
                          : 'bg-[#516173] group-hover:bg-[#94A3B8] group-focus-visible:bg-[#94A3B8]',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/methodology"
            className={({ isActive }) =>
              cn(
                'group mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
                isActive
                  ? 'bg-white/8 text-white shadow-[0_10px_26px_rgba(0,0,0,0.22)]'
                  : 'text-[#A9B6CC] hover:bg-white/5 hover:text-white hover:shadow-[0_10px_26px_rgba(0,0,0,0.22)] active:scale-[0.99]',
                collapsedValue ? 'justify-start' : 'justify-between',
              )
            }
            onClick={() => onNavigate?.()}
            ref={(el) => {
              itemRefs.current['methodology'] = el as unknown as HTMLElement | null
            }}
            title={collapsedValue ? '数据与方法' : undefined}
            aria-label={collapsedValue ? '数据与方法' : undefined}
          >
            <span className={cn('inline-flex items-center gap-3', collapsedValue ? 'justify-center' : 'min-w-0')}>
              <BookOpen className={cn('h-4 w-4 shrink-0', isMethod ? 'text-[#FF8A66]' : 'text-[#94A3B8] group-hover:text-[#E6EDF7]')} />
              {collapsedValue ? null : <span className="truncate">数据与方法</span>}
            </span>
            {collapsedValue ? null : (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-[#FF5722] transition-all duration-200',
                  isMethod ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover:opacity-60 group-hover:scale-90',
                )}
                aria-hidden="true"
              />
            )}
          </NavLink>
        </div>

        {collapseBtn}
      </div>
    </aside>
  )
}
