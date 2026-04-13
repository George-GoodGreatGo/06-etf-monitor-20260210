import { useEffect, useMemo, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import MarketBoardAiInsight from '@/components/MarketBoardAiInsight'
import MarketLiquidityChart from '@/components/charts/MarketLiquidityChart'
import MarketLiquidityTable from '@/components/MarketLiquidityTable'
import { cn } from '@/lib/utils'
import { fetchMarketLiquidityV5, type EquityBondPoint, type LiquidityV5Point } from '@/utils/marketApi'
import type { Top100Meta } from '@/utils/etfApi'

function calcState(v5: number | null | undefined): { label: string; cls: string } {
  if (typeof v5 !== 'number' || !Number.isFinite(v5)) return { label: '—', cls: 'text-[#94A3B8]' }
  if (v5 < 30) return { label: '机会区', cls: 'text-[#34D399]' }
  if (v5 > 70) return { label: '风险区', cls: 'text-[#F87171]' }
  return { label: '中性区', cls: 'text-[#94A3B8]' }
}

function fmt(v: number | null | undefined, digits: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits).replace(/\.0+$/, '')
}

export default function MarketLiquidityPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [series, setSeries] = useState<LiquidityV5Point[]>([])
  const [equityBond, setEquityBond] = useState<EquityBondPoint[]>([])
  const [view, setView] = useState<'chart' | 'table'>('chart')

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchMarketLiquidityV5(ac.signal)
        if (res.success === false) {
          setMeta(null)
          setSeries([])
          setEquityBond([])
          setError(res.message ?? res.error)
          setLoading(false)
          return
        }
        setMeta(res.meta)
        setSeries(res.data.series || [])
        setEquityBond(res.data.equityBond?.series || [])
        setLoading(false)
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
        setMeta(null)
        setSeries([])
        setEquityBond([])
        setError('网络异常或 API 不可用')
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [])

  const latest = series.length ? series[series.length - 1] : null
  const state = useMemo(() => calcState(latest?.v5), [latest?.v5])
  const latestEquityBond = useMemo(() => {
    if (!equityBond.length) return null
    const d = latest?.date
    if (d) {
      for (let i = equityBond.length - 1; i >= 0; i--) {
        if (equityBond[i]?.date === d) return equityBond[i]
      }
    }
    return equityBond[equityBond.length - 1] ?? null
  }, [equityBond, latest?.date])

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">沪深市场大盘看板</div>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p><span className="font-medium text-[#CBD5E1]">沪深300</span>：反映中国A股市场整体表现的核心宽基指数。</p>
            <p><span className="font-medium text-[#CBD5E1]">EMA20 / EMA60</span>：20日/60日指数移动平均线，辅助判断短、中长期趋势。</p>
            <p><span className="font-medium text-[#CBD5E1]">独家流动性指数（3指标）</span>：=(成交额分位×换手率分位×北向资金分位)^(1/3)，5年滚动（≈1260，最少≈630）。&lt;30 为机会区，&gt;70 为风险区。</p>
            <p><span className="font-medium text-[#CBD5E1]">独家流动性指数（分位）</span>：v5 的 5 年滚动分位（0–100）。越高表示近 5 年综合流动性越偏高位/过热，越低越偏低位/冷却（相对刻度）。</p>
            <p><span className="font-medium text-[#CBD5E1]">股债性价比（分位）</span>：value=1/沪深300PE-10Y国债收益率（%）/100；分位为过去5年滚动分位（≈1260，最少≈630）。</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
            <button
              type="button"
              onClick={() => setView('chart')}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
                view === 'chart' ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
              )}
            >
              图表视图
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
                view === 'table' ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
              )}
            >
              表格视图
            </button>
          </div>

          <div className="min-w-[240px] rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[#94A3B8]">数据日期</div>
              <div className="font-mono text-[11px] text-[#A9B6CC]">{latest?.date ?? '—'}</div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">沪深300点位</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latest?.close, 2)}</div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">独家流动性指数</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latest?.v5, 1)}</div>
                  <div className={cn('text-xs font-medium', state.cls)}>{state.label}</div>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">股债性价比（分位）</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latestEquityBond?.pct, 1)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <DataStatusBanner
          loading={loading}
          error={error}
          meta={meta}
          incompleteCount={0}
          onRetry={() => {
            window.location.reload()
          }}
        />
      </div>

      <div className="mt-4">
        <div className="relative">
          <div className={cn(view === 'chart' ? 'block' : 'hidden')}>
            <MarketLiquidityChart series={series} equityBond={equityBond} />
          </div>
          <div className={cn(view === 'table' ? 'block' : 'hidden')}>
            <MarketLiquidityTable series={series} equityBond={equityBond} />
          </div>
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

      <MarketBoardAiInsight />
    </section>
  )
}

