import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorType, CrosshairMode, LineSeries, LineStyle, createChart, type IChartApi, type ISeriesApi, type LineData, type Time, type UTCTimestamp } from 'lightweight-charts'
import { cn } from '@/lib/utils'
import type { LiquidityV5Point } from '@/utils/marketApi'

const SCALE_MIN_WIDTH = 92

function ymdToUtcSeconds(ymd: string): UTCTimestamp | null {
  const s = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const year = Number(s.slice(0, 4))
  const month = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  return Math.floor(ms / 1000) as UTCTimestamp
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return s.replace(/\.00$/, '')
}

type Props = {
  series: LiquidityV5Point[]
  className?: string
}

type HoverState = {
  t: UTCTimestamp
  date: string
  close?: number
  v5?: number
}

export default function MarketLiquidityChart({ series, className }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const hsRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const v5Ref = useRef<ISeriesApi<'Line', Time> | null>(null)
  const [hover, setHover] = useState<HoverState | null>(null)

  const data = useMemo(() => {
    const hs: LineData<Time>[] = []
    const v5: LineData<Time>[] = []
    const map = new Map<UTCTimestamp, HoverState>()

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      hs.push({ time: t, value: p.close })
      if (typeof p.v5 === 'number' && Number.isFinite(p.v5)) {
        v5.push({ time: t, value: p.v5 })
      }
      map.set(t, {
        t,
        date: p.date,
        close: p.close,
        v5: typeof p.v5 === 'number' && Number.isFinite(p.v5) ? p.v5 : undefined,
      })
    }

    return { hs, v5, map }
  }, [series])

  useEffect(() => {
    if (!elRef.current || chartRef.current) return

    const chart = createChart(elRef.current, {
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
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)', minimumWidth: SCALE_MIN_WIDTH },
      leftPriceScale: { borderColor: 'rgba(255,255,255,0.10)', minimumWidth: SCALE_MIN_WIDTH, visible: true },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })

    const hs = chart.addSeries(LineSeries, {
      color: '#60A5FA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    const v5 = chart.addSeries(LineSeries, {
      color: '#FF8A50',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: 'left',
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 1) },
    })

    v5.createPriceLine({
      price: 30,
      color: 'rgba(16,185,129,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '30',
    })
    v5.createPriceLine({
      price: 70,
      color: 'rgba(239,68,68,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '70',
    })

    hsRef.current = hs
    v5Ref.current = v5
    chartRef.current = chart

    chart.subscribeCrosshairMove((param: { time?: Time } | null) => {
      const time = param?.time
      if (typeof time !== 'number') {
        setHover(null)
        return
      }
      const t = time as UTCTimestamp
      setHover(data.map.get(t) ?? null)
    })

    return () => {
      chart.remove()
      chartRef.current = null
      hsRef.current = null
      v5Ref.current = null
    }
  }, [data.map])

  useEffect(() => {
    hsRef.current?.setData(data.hs)
    v5Ref.current?.setData(data.v5)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  return (
    <div className={cn('relative', className)}>
      {hover ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
          <div className="font-mono text-[11px] text-[#A9B6CC]">{hover.date}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-[#A9B6CC]">沪深300</div>
            <div className="text-right font-mono">{fmt(hover.close, 2)}</div>
            <div className="text-[#A9B6CC]">V5</div>
            <div className="text-right font-mono">{fmt(hover.v5, 1)}</div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
        沪深300 + A股市场流动性指数（V5几何平均）
      </div>
      <div ref={elRef} className="h-[360px] w-full" />
    </div>
  )
}

