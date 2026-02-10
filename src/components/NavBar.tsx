import { NavLink } from 'react-router-dom'
import { Loader2, RefreshCw } from 'lucide-react'
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
}: {
  rightMeta?: RightMeta
  onRefetch?: () => void
  refetching?: boolean
}) {
  return (
    <header className="border-b border-white/10 bg-[#0B1220]/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <NavLink to="/" className="text-sm font-semibold tracking-tight">
            ETF 监测
          </NavLink>
          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-xs text-[#A9B6CC] transition hover:bg-white/5 hover:text-[#E6EDF7]',
                  isActive && 'bg-white/5 text-[#E6EDF7]',
                )
              }
              end
            >
              Top100
            </NavLink>
            <NavLink
              to="/methodology"
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-xs text-[#A9B6CC] transition hover:bg-white/5 hover:text-[#E6EDF7]',
                  isActive && 'bg-white/5 text-[#E6EDF7]',
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
                  拉取时间： <span className="text-[#E6EDF7]">查询中</span>
                </div>
              </div>
            ) : rightMeta ? (
              <div className="space-y-0.5">
                <div>
                  数据交易日： <span className="text-[#E6EDF7]">{formatYmd(rightMeta.dataDate)}</span>
                </div>
                <div>
                  拉取时间： <span className="text-[#E6EDF7]">{parseIsoToLocal(rightMeta.fetchedAt)}</span>
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
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-[#E6EDF7] transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              重新获取
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

