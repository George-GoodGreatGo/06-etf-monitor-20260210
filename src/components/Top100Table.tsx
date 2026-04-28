import { ArrowUpDown, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import SortableTh, { type SortDir } from '@/components/SortableTh'
import ZBadge from '@/components/ZBadge'
import { cn } from '@/lib/utils'
import { type EtfTopRow, type Top100SortKey } from '@/utils/etfApi'
import type { MomentumStrategyId } from '@/utils/momentumStrategies'
import { formatCompactNumber, formatPct, formatYmd } from '@/utils/format'
import { getRowMomentumSignal } from '@/utils/top200SignalFilters'

function sortRows(rows: EtfTopRow[], key: Top100SortKey, dir: SortDir) {
  const sign = dir === 'asc' ? 1 : -1
  const get = (r: EtfTopRow) => {
    if (key === 'code') return r.code
    if (key === 'name') return r.name
    return r[key]
  }

  return [...rows].sort((a, b) => {
    const av = get(a)
    const bv = get(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sign
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
    return 0
  })
}

export default function Top100Table({
  rows,
  loading,
  error,
  sortKey,
  sortDir,
  onToggleSort,
  strategyId,
  buildRpsAnalysisHref,
}: {
  rows: EtfTopRow[]
  loading: boolean
  error: string | null
  sortKey: Top100SortKey
  sortDir: SortDir
  onToggleSort: (key: Top100SortKey) => void
  strategyId: MomentumStrategyId
  buildRpsAnalysisHref?: (row: EtfTopRow) => string
}) {
  const actionButtonClassName =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-[#E2E8F0] transition hover:border-[#475569] hover:bg-[#334155] hover:text-white'
  const data = sortRows(rows, sortKey, sortDir)

  function renderSignalCell(row: EtfTopRow) {
    const signal = getRowMomentumSignal(row, strategyId)
    if (!signal?.signalLabel) return <span className="text-[#64748B]">—</span>
    const toneClassName =
      signal.signalKey === 'buy'
        ? 'border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.35)] text-[#FECACA]'
        : signal.signalKey === 'risk_sell'
          ? 'border-[rgba(251,191,36,0.35)] bg-[rgba(120,53,15,0.35)] text-[#FDE68A]'
          : 'border-[rgba(16,185,129,0.35)] bg-[rgba(6,78,59,0.35)] text-[#BBF7D0]'
    return (
      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none', toneClassName)}>
        {signal.signalLabel}
      </span>
    )
  }

  function renderFreshnessCell(row: EtfTopRow) {
    const signal = getRowMomentumSignal(row, strategyId)
    if (!signal?.freshnessLabel) return <span className="text-[#64748B]">—</span>
    const toneClassName =
      signal.freshnessBucket === 'today'
        ? 'text-[#F8FAFC]'
        : signal.freshnessBucket === 'within_3d'
          ? 'text-[#E2E8F0]'
          : signal.freshnessBucket === 'within_5d'
            ? 'text-[#CBD5E1]'
            : 'text-[#94A3B8]'
    return <span className={cn('text-xs font-medium', toneClassName)}>{signal.freshnessLabel}</span>
  }

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="whitespace-nowrap border-b border-[#1E293B] bg-[#0B1120] text-xs font-medium text-[#94A3B8]">
            <tr>
              <th className="px-4 py-3">#</th>
              <SortableTh
                active={sortKey === 'code'}
                dir={sortDir}
                onClick={() => onToggleSort('code')}
                className="min-w-[110px]"
              >
                代码
              </SortableTh>
              <SortableTh
                active={sortKey === 'name'}
                dir={sortDir}
                onClick={() => onToggleSort('name')}
                className="min-w-[220px]"
              >
                名称
              </SortableTh>
              <SortableTh
                active={sortKey === 'volume'}
                dir={sortDir}
                onClick={() => onToggleSort('volume')}
                align="right"
                title="今日成交量（份）"
              >
                成交量
              </SortableTh>
              <SortableTh
                active={sortKey === 'turnover'}
                dir={sortDir}
                onClick={() => onToggleSort('turnover')}
                align="right"
                title="今日成交额（元）"
              >
                成交额
              </SortableTh>
              <SortableTh
                active={sortKey === 'turnoverChangePct1d'}
                dir={sortDir}
                onClick={() => onToggleSort('turnoverChangePct1d')}
                align="right"
                title="成交额较昨日变化百分比"
              >
                较昨±
              </SortableTh>
              <SortableTh
                active={sortKey === 'turnoverChangePct7dAvg'}
                dir={sortDir}
                onClick={() => onToggleSort('turnoverChangePct7dAvg')}
                align="right"
                title="成交额较7日平均变化百分比"
              >
                较7日均±
              </SortableTh>
              <SortableTh
                active={sortKey === 'z90'}
                dir={sortDir}
                onClick={() => onToggleSort('z90')}
                align="right"
                title="90日滚动Z值，衡量成交量偏离均值的程度"
              >
                90日Z
              </SortableTh>
              <th className="px-4 py-3">交易信号</th>
              <th className="px-4 py-3">信号新鲜度</th>
              <th className="px-4 py-3 text-right">RPS分析</th>
              <th className="px-4 py-3 text-right">异动详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-4 py-3 text-[#94A3B8]">{idx + 1}</td>
                  <td className="px-4 py-3" colSpan={9}>
                    <div className="h-4 w-full rounded bg-[#1E293B]" />
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td className="px-4 py-10" colSpan={12}>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="text-sm font-medium text-[#E2E8F0]">暂无可展示数据</div>
                    <div className="text-xs text-[#94A3B8]">
                      {error
                        ? '请先修复数据源/API，再刷新页面'
                        : '尝试调整当前筛选条件'}
                    </div>
                    <div className="mt-2">
                      <Link
                        to="/methodology"
                        className="ui-btn ui-btn-outline px-3 py-2 text-xs"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                        查看数据与方法说明
                      </Link>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((r, idx) => {
                const muted = r.dataStatus !== 'complete'
                return (
                  <tr
                    key={r.code}
                    className={cn(
                      'transition-colors duration-150 hover:bg-[rgba(255,87,34,0.06)]',
                      muted && 'opacity-70',
                    )}
                  >
                    <td className="px-4 py-3 text-xs text-[#64748B]">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#CBD5E1]">{r.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#F1F5F9]">{r.name}</div>
                      <div className="mt-0.5 text-xs text-[#64748B]">
                        {formatYmd(r.latestTradingDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#94A3B8]">
                      {r.volume == null ? '—' : formatCompactNumber(r.volume)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#F8FAFC]">
                      {r.turnover == null ? '—' : formatCompactNumber(r.turnover)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {r.turnoverChangePct1d == null ? (
                        <span className="text-[#94A3B8]">—</span>
                      ) : (
                        <span
                          className={cn(
                            r.turnoverChangePct1d > 0
                              ? 'text-[#F87171] font-medium'
                              : r.turnoverChangePct1d < 0
                                ? 'text-[#34D399] font-medium'
                                : 'text-[#94A3B8]',
                          )}
                        >
                          {formatPct(r.turnoverChangePct1d)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {r.turnoverChangePct7dAvg == null ? (
                        <span className="text-[#94A3B8]">—</span>
                      ) : (
                        <span
                          className={cn(
                            r.turnoverChangePct7dAvg > 0
                              ? 'text-[#F87171] font-medium'
                              : r.turnoverChangePct7dAvg < 0
                                ? 'text-[#34D399] font-medium'
                                : 'text-[#94A3B8]',
                          )}
                        >
                          {formatPct(r.turnoverChangePct7dAvg)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <ZBadge z={r.z90} status={r.dataStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderSignalCell(r)}</td>
                    <td className="px-4 py-3">{renderFreshnessCell(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <a
                          href={buildRpsAnalysisHref ? buildRpsAnalysisHref(r) : `/market/rps/custom-query?ticker=${encodeURIComponent(r.code)}`}
                          target="_blank"
                          rel="noreferrer"
                          className={actionButtonClassName}
                        >
                          查看
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <a
                          href={`/etf/${encodeURIComponent(r.code)}`}
                          target="_blank"
                          rel="noreferrer"
                          className={actionButtonClassName}
                        >
                          查看
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-[#1E293B] bg-[#0B1120] px-4 py-3 text-xs text-[#64748B]">
        <div>{`共 ${data.length} 条记录`}</div>
        <div>到底了</div>
      </div>
    </section>
  )
}
