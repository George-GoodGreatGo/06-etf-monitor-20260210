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
    <header className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.60)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-6 px-8 py-4">
        <div className="flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-3">
            <img src="/figma/login/login_logo.svg" alt="" className="h-7 w-7 select-none" aria-hidden="true" />
            <div className="text-xs font-black uppercase tracking-[0.12em] text-white sm:text-sm">
              ETF MONITOR <span className="text-[#FF5722]">AI</span>
            </div>
          </NavLink>
          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-xs font-semibold text-[#9CA3AF] transition hover:text-white',
                  isActive && 'bg-[rgba(255,255,255,0.06)] text-white',
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
                  'rounded-md px-3 py-2 text-xs font-semibold text-[#9CA3AF] transition hover:text-white',
                  isActive && 'text-white',
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-[#FF5722] px-4 text-xs font-semibold text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.35),0px_10px_15px_-3px_rgba(0,0,0,0.35)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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

