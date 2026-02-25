import { NavLink } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatYmd, parseIsoToLocal } from '@/utils/format'

type RightMeta = {
  fetchedAt: string
  dataDate: string
}

export default function NavBar({
  rightMeta,
  onRefetch,
  refetching,
  onLogout,
}: {
  rightMeta?: RightMeta
  onRefetch?: () => void
  refetching?: boolean
  onLogout?: () => void
}) {
  return (
    <header className="border-b border-[rgba(230,81,0,0.12)] bg-[rgba(5,10,11,0.65)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-3">
            <img src="/figma/login/login_logo.svg" alt="" className="h-7 w-7 select-none" aria-hidden="true" />
            <div className="text-xs font-black uppercase tracking-[0.1em] text-[#E6EDF7] sm:text-sm">
              ETF Monitor AI
            </div>
          </NavLink>
          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  'rounded-lg border border-transparent px-3 py-2 text-xs text-[#94A3B8] transition hover:bg-[rgba(230,81,0,0.08)] hover:text-white',
                  isActive && 'border-[rgba(230,81,0,0.18)] bg-[rgba(230,81,0,0.10)] text-white',
                )
              }
              end
            >
              Top200
            </NavLink>
            <NavLink
              to="/methodology"
              className={({ isActive }) =>
                cn(
                  'rounded-lg border border-transparent px-3 py-2 text-xs text-[#94A3B8] transition hover:bg-[rgba(230,81,0,0.08)] hover:text-white',
                  isActive && 'border-[rgba(230,81,0,0.18)] bg-[rgba(230,81,0,0.10)] text-white',
                )
              }
            >
              数据与方法
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="text-right text-xs text-[#A9B6CC]">
            {refetching ? (
              <div className="space-y-0.5">
                <div>
                  数据交易日： <span className="text-[#E6EDF7]">查询中</span>
                </div>
                <div>
                  快照时间： <span className="text-[#E6EDF7]">查询中</span>
                </div>
              </div>
            ) : rightMeta ? (
              <div className="space-y-0.5">
                <div>
                  数据交易日： <span className="text-[#E6EDF7]">{formatYmd(rightMeta.dataDate)}</span>
                </div>
                <div>
                  快照时间： <span className="text-[#E6EDF7]">{parseIsoToLocal(rightMeta.fetchedAt)}</span>
                </div>
              </div>
            ) : (
              <div>仅展示完整交易日数据</div>
            )}
          </div>

          {onRefetch ? (
            <button
              type="button"
              onClick={onRefetch}
              disabled={refetching}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#E65100] px-3 text-xs font-semibold text-white shadow-[0_0_0_1px_rgba(230,81,0,0.25)] transition hover:bg-[#FF6A1A] active:bg-[#D94D00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <img src="/figma/list/refetch_icon.svg" alt="" className="h-4 w-4 select-none" aria-hidden="true" />
              )}
              重新获取
            </button>
          ) : null}

          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[rgba(230,81,0,0.35)] bg-transparent px-3 text-xs font-semibold text-[#FF8A50] transition hover:bg-[rgba(230,81,0,0.10)] hover:text-[#FFE6DA]"
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

