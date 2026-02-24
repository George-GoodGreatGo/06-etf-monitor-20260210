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
      <div className="ui-glass-panel px-4 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingMode === 'refetch'
              ? '正在重新获取数据…'
              : loadingMode === 'cold'
                ? isEnsureLatestOnly
                  ? '正在校验最新交易日…'
                  : '正在首次计算数据…'
                : '正在通过 API 获取数据…'}
            {showProgress ? <span className="text-[#E6EDF7]">{pct}%</span> : null}
            {(loadingMode === 'refetch' || loadingMode === 'cold') && loadingEtaSeconds ? (
              <span className="text-[#A9B6CC]">（参考 {loadingEtaSeconds}s）</span>
            ) : null}
          </div>

          {showProgress ? (
            <div className="h-2 w-full rounded-full bg-white/5">
              <div
                className="h-2 rounded-full bg-[#E65100] transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}

          {(loadingMode === 'refetch' || loadingMode === 'cold') && backendProgressText ? (
            <div className="text-xs text-[#A9B6CC]">{backendProgressText}</div>
          ) : null}

          {showProgress && pct >= 99 ? (
            <div className="text-xs text-[#A9B6CC]">
              全量重算需要的时间较多，请耐心等待
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ui-glass-panel border border-[#EF4444]/40 px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-[#EF4444]" />
            <div>
              <div className="text-sm font-medium">数据获取失败</div>
              <div className="mt-0.5 text-xs text-[#A9B6CC]">
                {error}。不会展示任何推测值。
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="ui-btn ui-btn-accent h-9 px-3 text-xs"
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
          'ui-glass-panel px-4 py-3',
          notice.tone === 'warn' ? 'border border-[#F59E0B]/40' : 'border border-[rgba(230,81,0,0.15)]',
        )}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[#FF8A50]" />
            <div>
              <div className="text-sm font-medium">
                {notice.tone === 'warn' ? '刷新可能仍在后台运行' : '后台刷新中'}
              </div>
              <div className="mt-0.5 text-xs text-[#A9B6CC]">{notice.message}</div>
              <div className="mt-1 text-xs text-[#A9B6CC]">
                交易日：{meta ? formatYmd(meta.dataDate) : '—'}；快照时间：{snapshotAt ? parseIsoToLocal(snapshotAt) : '—'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRetry}
            className="ui-btn ui-btn-outline h-9 px-3 text-xs"
          >
            <RefreshCw className="h-4 w-4" />
            刷新页面数据
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ui-glass-panel px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-[#22C55E]" />
          <div>
            <div className="text-sm font-medium">数据已就绪（仅完整交易日）</div>
            <div className="mt-0.5 text-xs text-[#A9B6CC]">
              交易日：{meta ? formatYmd(meta.dataDate) : '—'}；快照时间：
              {snapshotAt ? parseIsoToLocal(snapshotAt) : '—'}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#A9B6CC]',
            incompleteCount > 0 && 'border-[#F59E0B]/40',
          )}
        >
          {incompleteCount > 0
            ? `已标记 ${incompleteCount} 条为“数据不完整/失败”，不展示推测值`
            : '全部条目字段校验通过'}
        </div>
      </div>
    </div>
  )
}

