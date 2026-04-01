import { useEffect, useMemo, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import MarketLiquidityChart from '@/components/charts/MarketLiquidityChart'
import { cn } from '@/lib/utils'
import { fetchMarketLiquidityV5, type EquityBondPoint, type LiquidityV5Point } from '@/utils/marketApi'
import type { Top100Meta } from '@/utils/etfApi'

function calcState(v5: number | null | undefined): { label: string; cls: string } {
  if (typeof v5 !== 'number' || !Number.isFinite(v5)) return { label: '—', cls: 'text-[#94A3B8]' }
  if (v5 < 30) return { label: '机会区', cls: 'text-[#34D399]' }
  if (v5 > 70) return { label: '风险区', cls: 'text-[#F87171]' }
  return { label: '中性区', cls: 'text-[#94A3B8]' }
}

export default function MarketLiquidityPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [series, setSeries] = useState<LiquidityV5Point[]>([])
  const [equityBond, setEquityBond] = useState<EquityBondPoint[]>([])

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

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">沪深市场大盘看板</div>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p><span className="font-medium text-[#CBD5E1]">沪深300</span>：反映中国A股市场整体表现的核心宽基指数。</p>
            <p><span className="font-medium text-[#CBD5E1]">EMA20 / EMA60</span>：20日/60日指数移动平均线，辅助判断短、中长期趋势。</p>
            <p><span className="font-medium text-[#CBD5E1]">独家流动性指数（3指标）</span>：=(成交额分位×换手率分位×北向资金分位)^(1/3)，360日滚动（最少180日）。&lt;30 为机会区，&gt;70 为风险区。</p>
            <p><span className="font-medium text-[#CBD5E1]">股债性价比（分位）</span>：沪深300股息率与10年期国债收益率的差值，在过去720天（最少360天）的滚动分位数。</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-xs">
            <div className="text-[#94A3B8]">最新流动性指数</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="font-mono text-sm font-semibold text-[#F8FAFC]">
                {typeof latest?.v5 === 'number' ? latest.v5.toFixed(1) : '—'}
              </div>
              <div className={cn('text-xs font-medium', state.cls)}>{state.label}</div>
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
        <MarketLiquidityChart series={series} equityBond={equityBond} />
      </div>
    </section>
  )
}

