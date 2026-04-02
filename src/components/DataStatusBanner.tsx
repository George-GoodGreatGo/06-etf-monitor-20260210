import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Top100Meta } from '@/utils/etfApi'
import { formatYmd, parseIsoToLocal } from '@/utils/format'

export default function DataStatusBanner({
  loading,
  error,
  notice,
  meta,
  incompleteCount,
  onRetry,
  loadingMode,
  loadingProgressPct,
  loadingEtaSeconds,
  backendProgressText,
}: {
  loading: boolean
  error: string | null
  notice?: { tone: 'info' | 'warn'; message: string } | null
  meta: Top100Meta | null
  incompleteCount: number
  onRetry: () => void
  loadingMode?: 'fetch' | 'refetch' | 'cold'
  loadingProgressPct?: number | null
  loadingEtaSeconds?: number
  backendProgressText?: string | null
}) {
  const snapshotAt = meta?.cachedAt || meta?.fetchedAt || null
  const source = typeof meta?.source === 'string' ? meta.source : null
  const notes = Array.isArray(meta?.notes) ? meta?.notes : null
  const staleSnapshot =
    source === 'stale-cache-from-last-success' ||
    (Array.isArray(notes) && notes.some((x) => typeof x === 'string' && x.includes('已回退上次成功快照')))
  const dataSourceLabel = staleSnapshot
    ? '快照数据源（最近一次成功快照）'
    : source && source.includes('codebuddy:financedata')
      ? '主数据源'
      : source && (source.includes('eastmoney') || source.includes('akshare') || source.includes('csindex'))
        ? '替代数据源'
        : '主数据源'

  if (loading) {
    const pct =
      typeof loadingProgressPct === 'number'
        ? Math.max(0, Math.min(100, Math.floor(loadingProgressPct)))
        : null
    const isEnsureLatestOnly =
      loadingMode === 'cold' &&
      typeof backendProgressText === 'string' &&
      backendProgressText.includes('校验最新交易日')
    const showProgress = (loadingMode === 'refetch' || (loadingMode === 'cold' && !isEnsureLatestOnly)) && pct != null
    return (
      <div className="relative overflow-hidden rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
        <div className="absolute left-0 top-0 h-full w-[2px] bg-[#FF5722]" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-[#E6EDF7]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF5722]" />
            <span className="font-semibold">
              {loadingMode === 'refetch'
                ? '正在重新获取数据…'
                : loadingMode === 'cold'
                  ? isEnsureLatestOnly
                    ? '正在校验最新交易日…'
                    : '正在首次计算数据…'
                  : '正在通过 API 获取数据…'}
            </span>
            {showProgress ? <span className="text-[#9CA3AF]">{pct}%</span> : null}
            {(loadingMode === 'refetch' || loadingMode === 'cold') && loadingEtaSeconds ? (
              <span className="text-xs text-[#6B7280]">（参考 {loadingEtaSeconds}s）</span>
            ) : null}
          </div>

          {showProgress ? (
            <div className="h-2 w-full rounded-full bg-[rgba(255,255,255,0.06)]">
              <div className="h-2 rounded-full bg-[#FF5722] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          ) : null}

          {(loadingMode === 'refetch' || loadingMode === 'cold') && backendProgressText ? (
            <div className="text-xs text-[#9CA3AF]">{backendProgressText}</div>
          ) : null}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative overflow-hidden rounded border border-[rgba(239,68,68,0.35)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
        <div className="absolute left-0 top-0 h-full w-[2px] bg-[#EF4444]" />
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />
            <span className="font-semibold text-white">数据获取失败</span>
            <span className="text-xs text-[#9CA3AF]">{error}。不会展示任何推测值。</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] bg-[#FF5722] px-3 text-xs font-semibold text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.35),0px_10px_15px_-3px_rgba(0,0,0,0.35)] transition hover:brightness-110 active:brightness-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    )
  }

  if (notice) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded border bg-[rgba(255,255,255,0.03)] px-3 py-2',
          notice.tone === 'warn' ? 'border-[rgba(245,158,11,0.35)]' : 'border-[rgba(255,255,255,0.08)]',
        )}
      >
        <div className={cn('absolute left-0 top-0 h-full w-[2px]', notice.tone === 'warn' ? 'bg-[#F59E0B]' : 'bg-[#FF5722]')} />
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            <Loader2 className={cn('h-3.5 w-3.5 animate-spin', notice.tone === 'warn' ? 'text-[#F59E0B]' : 'text-[#FF5722]')} />
            <span className="font-semibold text-white">{notice.tone === 'warn' ? '刷新可能仍在后台运行' : '后台刷新中'}</span>
            <span className="text-xs text-[#9CA3AF]">{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-3 text-xs font-semibold text-[#FF5722] transition hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新页面数据
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
      <div className="absolute left-0 top-0 h-full w-[2px] bg-[#10B981]" />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <div className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            <span className="font-semibold text-white">数据已就绪（仅完整交易日）</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
            <span>交易日：{meta ? formatYmd(meta.dataDate) : '—'}</span>
            <span>快照时间：{snapshotAt ? parseIsoToLocal(snapshotAt) : '—'}</span>
            {source ? (
              <span>
                数据来源：{dataSourceLabel}
                {staleSnapshot ? '（非实时）' : ''}
                <span className="font-mono text-[11px] text-[#6B7280]">{` · ${source}`}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            'inline-flex items-center rounded-[6px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5 text-xs text-[#9CA3AF]',
            incompleteCount > 0 && 'border-[rgba(255,87,34,0.25)]',
          )}
        >
          {incompleteCount > 0 ? `已标记 ${incompleteCount} 条为“数据不完整/失败”` : '已完成校验'}
        </div>
      </div>
    </div>
  )
}
