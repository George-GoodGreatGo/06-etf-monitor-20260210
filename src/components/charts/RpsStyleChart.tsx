import { useEffect, useMemo, useRef } from 'react'
import { ColorType, CrosshairMode, LineSeries, createChart, type IChartApi, type ISeriesApi, type LineData, type Time, type UTCTimestamp } from 'lightweight-charts'
import type { RpsStyleSeriesPoint } from '@/utils/marketApi'

type Props = {
  seriesByTicker: Record<string, RpsStyleSeriesPoint[]>
}

function ymdToUtcSeconds(ymd: string): UTCTimestamp | null {
  const s = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return Math.floor(Date.UTC(y, m - 1, d) / 1000) as UTCTimestamp
}

const COLORS = ['#60A5FA', '#F59E0B', '#34D399', '#F87171'] as const

export default function RpsStyleChart({ seriesByTicker }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineRefs = useRef<Array<ISeriesApi<'Line', Time>>>([])

  const prepared = useMemo(() => {
    const tickers = Object.keys(seriesByTicker).sort()
    return tickers.map((ticker, idx) => {
      const src = Array.isArray(seriesByTicker[ticker]) ? seriesByTicker[ticker] : []
      const rps: LineData<Time>[] = []
      const ma50: LineData<Time>[] = []
      for (const p of src) {
        const t = ymdToUtcSeconds(p.date)
        if (!t) continue
        if (typeof p.rpsRaw === 'number' && Number.isFinite(p.rpsRaw)) rps.push({ time: t, value: p.rpsRaw })
        if (typeof p.rpsMa50 === 'number' && Number.isFinite(p.rpsMa50)) ma50.push({ time: t, value: p.rpsMa50 })
      }
      rps.sort((a, b) => (a.time as number) - (b.time as number))
      ma50.sort((a, b) => (a.time as number) - (b.time as number))
      return { ticker, color: COLORS[idx % COLORS.length], rps, ma50 }
    })
  }, [seriesByTicker])

  useEffect(() => {
    const el = hostRef.current
    if (!el || chartRef.current) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#111B2E' },
        textColor: '#A9B6CC',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.10)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: { mouseWheel: false },
      handleScroll: { mouseWheel: false },
    })
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
      lineRefs.current = []
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    for (const s of lineRefs.current) chart.removeSeries(s)
    lineRefs.current = []

    for (const item of prepared) {
      const rpsSeries = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      })
      rpsSeries.setData(item.rps)
      lineRefs.current.push(rpsSeries)

      const maSeries = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      maSeries.setData(item.ma50)
      lineRefs.current.push(maSeries)
    }
    chart.timeScale().fitContent()
  }, [prepared])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A9B6CC]">
        {prepared.map((x) => (
          <div key={x.ticker} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: x.color }} />
            <span className="font-mono">{x.ticker}</span>
            <span className="text-[#64748B]">RPS 实线 / MA50 虚线</span>
          </div>
        ))}
      </div>
      <div ref={hostRef} className="h-[360px] w-full rounded-lg border border-white/10 bg-[#111B2E]" />
    </div>
  )
}
