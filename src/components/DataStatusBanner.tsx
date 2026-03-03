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
      <div className="relative overflow-hidden rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-[#FF5722]" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[13px] text-[#E6EDF7]">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF5722]" />
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
      <div className="relative overflow-hidden rounded border border-[rgba(239,68,68,0.35)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-[#EF4444]" />
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[13px]">
            <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
            <span className="font-semibold text-white">数据获取失败</span>
            <span className="text-xs text-[#9CA3AF]">{error}。不会展示任何推测值。</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-[#FF5722] px-4 text-xs font-semibold text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.35),0px_10px_15px_-3px_rgba(0,0,0,0.35)] transition hover:brightness-110 active:brightness-95"
          >
            <RefreshCw className="h-4 w-4" />
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
          'relative overflow-hidden rounded border bg-[rgba(255,255,255,0.03)] px-4 py-2.5',
          notice.tone === 'warn' ? 'border-[rgba(245,158,11,0.35)]' : 'border-[rgba(255,255,255,0.08)]',
        )}
      >
        <div className={cn('absolute left-0 top-0 h-full w-[3px]', notice.tone === 'warn' ? 'bg-[#F59E0B]' : 'bg-[#FF5722]')} />
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[13px]">
            <Loader2 className={cn('h-4 w-4 animate-spin', notice.tone === 'warn' ? 'text-[#F59E0B]' : 'text-[#FF5722]')} />
            <span className="font-semibold text-white">{notice.tone === 'warn' ? '刷新可能仍在后台运行' : '后台刷新中'}</span>
            <span className="text-xs text-[#9CA3AF]">{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 text-xs font-semibold text-[#FF5722] transition hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.06)]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新页面数据
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5">
      <div className="absolute left-0 top-0 h-full w-[3px] bg-[#10B981]" />
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 text-[13px]">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <span className="font-semibold text-white">数据已就绪（仅完整交易日）</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#9CA3AF]">
            <span>交易日：{meta ? formatYmd(meta.dataDate) : '—'}</span>
            <span>快照时间：{snapshotAt ? parseIsoToLocal(snapshotAt) : '—'}</span>
          </div>
        </div>

        <div
          className={cn(
            'inline-flex items-center rounded-[6px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-[#9CA3AF]',
            incompleteCount > 0 && 'border-[rgba(255,87,34,0.25)]',
          )}
        >
          {incompleteCount > 0 ? `已标记 ${incompleteCount} 条为“数据不完整/失败”` : '已完成校验'}
        </div>
      </div>
    </div>
  )
}

