import { useEffect, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import LowVolOpportunityChart from '@/components/charts/LowVolOpportunityChart'
import { cn } from '@/lib/utils'
import { fetchLowVolIndex, type LowVolH30269Point } from '@/utils/marketApi'
import type { Top100Meta } from '@/utils/etfApi'

function fmt(v: number | null | undefined, digits: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits).replace(/\.0+$/, '')
}

const INDEX_OPTIONS = [
  { code: 'H30269', label: '红利低波' },
  { code: '932365', label: '自由现金流' },
  { code: '932315', label: '红利质量' },
] as const

function calcSuggestion(args: {
  spreadPctRank10y: number | null | undefined
  biasPct3y: number | null | undefined
}): { label: string; cls: string } {
  const spread = args.spreadPctRank10y
  const bias = args.biasPct3y
  if (typeof spread !== 'number' || !Number.isFinite(spread)) return { label: '—', cls: 'text-[#94A3B8]' }
  const cheap = spread >= 80
  const expensive = spread <= 20
  const lowBias = typeof bias === 'number' && Number.isFinite(bias) ? bias <= 20 : false
  const highBias = typeof bias === 'number' && Number.isFinite(bias) ? bias >= 85 : false
  if (highBias) return { label: '偏减仓', cls: 'text-[#F87171]' }
  if (cheap && lowBias) return { label: '偏配置', cls: 'text-[#34D399]' }
  if (cheap) return { label: '偏配置', cls: 'text-[#FBBF24]' }
  return { label: '偏观望', cls: 'text-[#94A3B8]' }
}

export default function LowVolOpportunityPanel() {
  const [indexCode, setIndexCode] = useState<(typeof INDEX_OPTIONS)[number]['code']>('H30269')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [series, setSeries] = useState<LowVolH30269Point[]>([])

  const run = async (nextCode?: string) => {
    const code = String(nextCode || indexCode).trim()
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const id = window.setTimeout(() => ac.abort(), 120_000)
    try {
      const r = await fetchLowVolIndex({ code, signal: ac.signal })
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
  }, [indexCode])

  const latest = series.length ? series[series.length - 1] : null
  const suggestion = calcSuggestion({ spreadPctRank10y: latest?.spreadPctRank10y, biasPct3y: latest?.biasPct3y })
  const indexLabel = INDEX_OPTIONS.find((x) => x.code === indexCode)?.label ?? indexCode

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#111B2E] px-3 py-2">
        <div className="mr-1 text-xs font-medium text-[#A9B6CC]">指数切换</div>
        {INDEX_OPTIONS.map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => {
              if (opt.code === indexCode) return
              setIndexCode(opt.code)
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition',
              opt.code === indexCode
                ? 'border-white/15 bg-white/10 text-[#E6EDF7]'
                : 'border-white/10 bg-transparent text-[#A9B6CC] hover:border-white/15 hover:bg-white/5',
            )}
          >
            {opt.label}（{opt.code}）
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">低波指数机会识别</div>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p>
              <span className="font-medium text-[#CBD5E1]">
                {indexLabel}（{indexCode}）
              </span>
              ：以红利/现金流等因子构建的指数序列，用于跟踪“类债权益”机会。
            </p>
            <p>
              <span className="font-medium text-[#CBD5E1]">股息收益率</span>：滚动1年（252交易日），由 PRI/TRI 推算的分红贡献（回溯口径）。
            </p>
            <p>
              <span className="font-medium text-[#CBD5E1]">利差（核心）</span>：对“分红点数”做250日SMA（minPeriods=126）后，计算 股息收益率(修正)-10Y。
            </p>
            <p>
              <span className="font-medium text-[#CBD5E1]">利差分位(10年)</span>：基于 核心利差 的 10 年滚动分位（window≈2520，minPeriods=252）。
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="min-w-[240px] rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[#94A3B8]">指数</div>
              <div className="font-mono text-[11px] text-[#A9B6CC]">
                {indexLabel}（{indexCode}）
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[#94A3B8]">数据日期</div>
              <div className="font-mono text-[11px] text-[#A9B6CC]">{latest?.date ?? '—'}</div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">指数点位</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latest?.close, 2)}</div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">利差分位(10年)</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latest?.spreadPctRank10y, 1)}</div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">建议</div>
                <div className={cn('text-xs font-medium', suggestion.cls)}>{suggestion.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <DataStatusBanner loading={loading} error={error} meta={meta} incompleteCount={0} onRetry={run} />
      </div>

      <div className="mt-4">
        <LowVolOpportunityChart series={series} />
      </div>
    </section>
  )
}

