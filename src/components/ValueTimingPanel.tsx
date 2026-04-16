import { useCallback, useEffect, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import ValueTimingChart from '@/components/charts/ValueTimingChart'
import { cn } from '@/lib/utils'
import { fetchValueTimingIndex, type ValueTimingPoint } from '@/utils/marketApi'
import { calcValueTimingSuggestion } from '@/utils/valueTimingSignal'
import type { Top100Meta } from '@/utils/etfApi'
import { formatYmd, parseIsoToLocal } from '@/utils/format'

function fmt(v: number | null | undefined, digits: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits).replace(/\.0+$/, '')
}

function suggestionToneToTextCls(tone: ReturnType<typeof calcValueTimingSuggestion>['tone']): string {
  if (tone === 'bad') return 'text-[#F87171]'
  if (tone === 'good') return 'text-[#34D399]'
  if (tone === 'warn') return 'text-[#FBBF24]'
  if (tone === 'neutral') return 'text-[#60A5FA]'
  return 'text-[#94A3B8]'
}

export default function ValueTimingPanel(props: {
  indexCode: string
  indexLabel: string
  indexDesc?: string
  biasBasis: 'sma250' | 'sma60'
}) {
  const indexCode = props.indexCode
  const indexLabel = props.indexLabel
  const indexDesc = props.indexDesc
  const biasBasis = props.biasBasis
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [series, setSeries] = useState<ValueTimingPoint[]>([])

  const run = useCallback(async () => {
    const code = String(indexCode || '').trim()
    setLoading(true)
    setError(null)
    const ac = new AbortController()
    const id = window.setTimeout(() => ac.abort(), 120_000)
    try {
      const r = await fetchValueTimingIndex({ code, signal: ac.signal })
      if (r.success !== true) {
        setError(r.message || 'API 调用失败')
        setLoading(false)
        return
      }
      const m = r.meta && typeof r.meta === 'object' ? (r.meta as Top100Meta) : null
      const s =
        r.data && typeof r.data === 'object' && Array.isArray((r.data as { series?: unknown }).series)
          ? ((r.data as { series: ValueTimingPoint[] }).series ?? [])
          : []
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
  }, [indexCode])

  useEffect(() => {
    void run()
  }, [run])

  const latest = series.length ? series[series.length - 1] : null
  const biasPct = biasBasis === 'sma60' ? latest?.biasPct3y60 : latest?.biasPct3y
  const suggestion = calcValueTimingSuggestion({
    spreadPctRank5y: latest?.spreadPctRank5y,
    biasPct3y: biasPct,
  })
  const suggestionCls = suggestionToneToTextCls(suggestion.tone)
  const sourceType = meta && typeof meta === 'object' ? ((meta as unknown as { sourceType?: unknown }).sourceType as unknown) : null
  const snapshotAt = meta && typeof meta === 'object' ? ((meta as unknown as { snapshotAt?: unknown }).snapshotAt as unknown) : null
  const dataDateRaw = meta && typeof meta === 'object' ? ((meta as unknown as { dataDate?: unknown }).dataDate as unknown) : null
  const dataDate = typeof dataDateRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataDateRaw) ? dataDateRaw : null
  const today = (() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })()
  const isNotToday = Boolean(dataDate && dataDate < today)
  const isSnapshot = sourceType === 'snapshot'
  const peSourceNotes = Array.isArray(latest?.peSourceNotes) ? latest.peSourceNotes.map((x) => String(x)) : []
  const etfFallbackActive = peSourceNotes.some((s) => s.includes('159263') || s.includes('fallback_etf'))
  const isValue100 = indexCode === '980081'
  const sampleTip = latest?.spreadPctRank5y == null ? '样本期不足或估值缺失，分位可能为空' : null

  return (
    <section className="mt-3 overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">{indexLabel}择时分析</div>
          {isSnapshot ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#A9B6CC]">
              <span>快照数据（非最新）</span>
              <span className="text-[#64748B]">·</span>
              <span>快照时间：{typeof snapshotAt === 'string' && snapshotAt ? parseIsoToLocal(snapshotAt) : '—'}</span>
            </div>
          ) : null}
          {isNotToday ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#A9B6CC]">
              <span>数据截至：{formatYmd(dataDate)}</span>
              <span className="text-[#64748B]">·</span>
              <span>今日未更新/非交易日，已显示最近交易日数据</span>
            </div>
          ) : null}
          {etfFallbackActive || sampleTip || isValue100 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {etfFallbackActive ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#A9B6CC]">
                  980081 当前估值采用 ETF 替代口径（159263）
                </span>
              ) : null}
              {isValue100 ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#A9B6CC]">
                  动态PE：历史数据来自 touzid（截至2026/4/13），增量数据来自国证指数官网每日抓取
                </span>
              ) : null}
              {sampleTip ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#A9B6CC]">
                  {sampleTip}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p>
              <span className="font-medium text-[#CBD5E1]">
                {indexLabel}（{indexCode}）
              </span>
              ：{indexDesc ?? '以估值与利率的相对关系衡量阶段性风险收益。'}
            </p>
            <p>
              <span className="font-medium text-[#CBD5E1]">盈利收益率</span>：按 1/PE 计算（百分比口径）。
            </p>
            <p>
              <span className="font-medium text-[#CBD5E1]">股债利差（核心）</span>：盈利收益率(=1/PE)-10Y。
            </p>
            <p>
              <span className="font-medium text-[#CBD5E1]">股债利差分位(5年)</span>：核心股债利差的 5 年滚动分位（window≈1260，minPeriods=252）。
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
                <div className="text-[#94A3B8]">盈利收益率</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">
                  {latest?.earningsYieldPct != null ? `${fmt(latest.earningsYieldPct, 2)}%` : '—'}
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">股债利差分位(5年)</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latest?.spreadPctRank5y, 1)}</div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">建议</div>
                <div className={cn('text-xs font-medium', suggestionCls)}>{suggestion.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <DataStatusBanner loading={loading} error={error} meta={meta} incompleteCount={0} onRetry={() => void run()} />
      </div>

      <div className="mt-4">
        <div className="relative">
          <ValueTimingChart series={series} indexCode={indexCode} indexLabel={indexLabel} indexDesc={indexDesc} biasBasis={biasBasis} />
          {loading && !error ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/10 backdrop-blur-[1px]">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-[#E6EDF7]">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                正在加载图表数据…
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
