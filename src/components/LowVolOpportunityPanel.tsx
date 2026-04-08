import { useEffect, useMemo, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import LowVolH30269Chart from '@/components/charts/LowVolH30269Chart'
import { cn } from '@/lib/utils'
import { fetchLowVolH30269, type LowVolH30269Point } from '@/utils/marketApi'
import type { Top100Meta } from '@/utils/etfApi'

type ViewKey = 'close' | 'bias' | 'biasPct' | 'spread' | 'spreadPct'

export default function LowVolOpportunityPanel() {
  const [view, setView] = useState<ViewKey>('close')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [series, setSeries] = useState<LowVolH30269Point[]>([])

  const run = async () => {
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const id = window.setTimeout(() => ac.abort(), 120_000)
    try {
      const r = await fetchLowVolH30269(ac.signal)
      if (r.success !== true) {
        setError(r.message || 'API 调用失败')
        setLoading(false)
        return
      }
      const m = r.meta && typeof r.meta === 'object' ? (r.meta as Top100Meta) : null
      const s = r.data && typeof r.data === 'object' && Array.isArray((r.data as { series?: unknown }).series) ? ((r.data as { series: LowVolH30269Point[] }).series ?? []) : []
      setMeta(m)
      setSeries(s)
      setLoading(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const name = e instanceof Error ? e.name : ''
      const aborted = name === 'AbortError' || msg.toLowerCase().includes('aborted')
      setError(aborted ? '请求已取消/超时' : msg || '网络异常或 API 不可用')
      setLoading(false)
    } finally {
      window.clearTimeout(id)
    }
  }

  useEffect(() => {
    void run()
  }, [])

  const buttons = useMemo(
    () =>
      [
        { key: 'close' as const, label: '指数点位' },
        { key: 'bias' as const, label: 'BIAS(250)' },
        { key: 'biasPct' as const, label: 'BIAS分位(3年)' },
        { key: 'spread' as const, label: '利差（平滑）' },
        { key: 'spreadPct' as const, label: '利差分位(10年)' },
      ] satisfies Array<{ key: ViewKey; label: string }>,
    [],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 pt-5 sm:px-4">
      <div className="mb-3">
        <DataStatusBanner loading={loading} error={error} meta={meta} incompleteCount={0} onRetry={run} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-white">低波指数机会识别 · 红利低波（H30269）</div>
      </div>
      <div className="mb-3 text-xs text-[#94A3B8]">
        股息收益率=滚动1年（PRI/TRI推算）；利差（平滑）=spreadRaw 的 EWMA（半衰期6个月）；利差分位基于 raw 的10年滚动分位。
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setView(b.key)}
            className={cn(
              'h-8 rounded-[8px] px-3 text-xs font-semibold transition',
              view === b.key
                ? 'bg-white text-black'
                : 'border border-white/10 bg-[rgba(255,255,255,0.03)] text-[#E5E7EB] hover:bg-[rgba(255,255,255,0.06)]',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <LowVolH30269Chart series={series} view={view} />
    </div>
  )
}

