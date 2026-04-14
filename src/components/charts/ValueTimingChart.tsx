import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import type { ValueTimingPoint } from '@/utils/marketApi'

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

function normalizeTime(t: Time | undefined): UTCTimestamp | null {
  if (t == null) return null
  if (typeof t === 'number') return t as UTCTimestamp
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const year = Number((t as { year: unknown }).year)
    const month = Number((t as { month: unknown }).month)
    const day = Number((t as { day: unknown }).day)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
    const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    return Math.floor(ms / 1000) as UTCTimestamp
  }
  return null
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return s.replace(/\.00$/, '')
}

type HoverState = {
  t: UTCTimestamp
  date: string
  close?: number
  pe?: number
  earningsYieldPct?: number
  yield10yPct?: number
  spreadPct?: number
  spreadPctRank5y?: number
}

export default function ValueTimingChart(props: { series: ValueTimingPoint[]; className?: string }) {
  const series = props.series
  const [hover, setHover] = useState<HoverState | null>(null)

  const priceElRef = useRef<HTMLDivElement | null>(null)
  const spreadElRef = useRef<HTMLDivElement | null>(null)

  const chartsRef = useRef<{ price: IChartApi | null; spread: IChartApi | null }>({ price: null, spread: null })
  const seriesRef = useRef<{ price: any; spread: any }>({ price: null, spread: null })

  const data = useMemo(() => {
    const price: LineData<Time>[] = []
    const spreadPct: LineData<Time>[] = []
    const map = new Map<UTCTimestamp, HoverState>()

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      if (typeof p.close === 'number' && Number.isFinite(p.close)) price.push({ time: t, value: p.close })
      if (typeof p.spreadPctRank5y === 'number' && Number.isFinite(p.spreadPctRank5y)) spreadPct.push({ time: t, value: p.spreadPctRank5y })
      map.set(t, {
        t,
        date: p.date,
        close: typeof p.close === 'number' && Number.isFinite(p.close) ? p.close : undefined,
        pe: typeof p.pe === 'number' && Number.isFinite(p.pe) ? p.pe : undefined,
        earningsYieldPct: typeof p.earningsYieldPct === 'number' && Number.isFinite(p.earningsYieldPct) ? p.earningsYieldPct : undefined,
        yield10yPct: typeof p.yield10yPct === 'number' && Number.isFinite(p.yield10yPct) ? p.yield10yPct : undefined,
        spreadPct: typeof p.spreadPct === 'number' && Number.isFinite(p.spreadPct) ? p.spreadPct : undefined,
        spreadPctRank5y: typeof p.spreadPctRank5y === 'number' && Number.isFinite(p.spreadPctRank5y) ? p.spreadPctRank5y : undefined,
      })
    }

    price.sort((a, b) => (a.time as number) - (b.time as number))
    spreadPct.sort((a, b) => (a.time as number) - (b.time as number))
    return { price, spreadPct, map }
  }, [series])

  useEffect(() => {
    const priceEl = priceElRef.current
    const spreadEl = spreadElRef.current
    if (!priceEl || !spreadEl) return

    const priceChart = createChart(priceEl, {
      width: priceEl.clientWidth,
      height: 260,
      layout: {
        background: { type: ColorType.Solid, color: '#0B1220' },
        textColor: '#A9B6CC',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.10)' },
      crosshair: { mode: CrosshairMode.Normal },
    })

    const spreadChart = createChart(spreadEl, {
      width: spreadEl.clientWidth,
      height: 180,
      layout: {
        background: { type: ColorType.Solid, color: '#0B1220' },
        textColor: '#A9B6CC',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.10)' },
      crosshair: { mode: CrosshairMode.Normal },
    })

    const priceSeries = priceChart.addSeries(LineSeries, { color: '#60A5FA', lineWidth: 2 })
    const spreadSeries = spreadChart.addSeries(LineSeries, { color: '#FBBF24', lineWidth: 2 })

    chartsRef.current = { price: priceChart, spread: spreadChart }
    seriesRef.current = { price: priceSeries, spread: spreadSeries }

    const ro = new ResizeObserver(() => {
      const pw = priceEl.clientWidth
      const sw = spreadEl.clientWidth
      priceChart.applyOptions({ width: pw })
      spreadChart.applyOptions({ width: sw })
    })
    ro.observe(priceEl)
    ro.observe(spreadEl)

    const onCrosshair = (param: any) => {
      const t = normalizeTime(param?.time)
      if (!t) {
        setHover(null)
        return
      }
      const h = data.map.get(t) ?? null
      setHover(h)
    }
    priceChart.subscribeCrosshairMove(onCrosshair)
    spreadChart.subscribeCrosshairMove(onCrosshair)

    return () => {
      priceChart.unsubscribeCrosshairMove(onCrosshair)
      spreadChart.unsubscribeCrosshairMove(onCrosshair)
      ro.disconnect()
      priceChart.remove()
      spreadChart.remove()
      chartsRef.current = { price: null, spread: null }
      seriesRef.current = { price: null, spread: null }
    }
  }, [data.map])

  useEffect(() => {
    const priceSeries = seriesRef.current.price
    const spreadSeries = seriesRef.current.spread
    if (!priceSeries || !spreadSeries) return
    priceSeries.setData(data.price)
    spreadSeries.setData(data.spreadPct)
    const priceChart = chartsRef.current.price
    const spreadChart = chartsRef.current.spread
    if (priceChart) priceChart.timeScale().fitContent()
    if (spreadChart) spreadChart.timeScale().fitContent()
  }, [data.price, data.spreadPct])

  return (
    <div className={cn('rounded-lg border border-[#1E293B] bg-[#0B1220] p-3', props.className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[12px] text-[#94A3B8]">
        <div className="font-mono text-[11px] text-[#A9B6CC]">{hover?.date ?? (series.length ? series[series.length - 1].date : '—')}</div>
        <div className="flex flex-wrap items-center gap-3">
          <div>PE {fmt(hover?.pe, 2)}</div>
          <div>盈利收益率 {hover?.earningsYieldPct != null ? `${fmt(hover.earningsYieldPct, 2)}%` : '—'}</div>
          <div>10Y {hover?.yield10yPct != null ? `${fmt(hover.yield10yPct, 2)}%` : '—'}</div>
          <div>利差 {hover?.spreadPct != null ? `${fmt(hover.spreadPct, 2)}%` : '—'}</div>
          <div>利差分位 {fmt(hover?.spreadPctRank5y, 1)}</div>
        </div>
      </div>
      <div ref={priceElRef} className="w-full overflow-hidden rounded-md" />
      <div className="mt-3">
        <div className="mb-2 text-xs font-medium text-[#94A3B8]">利差分位(5年)</div>
        <div ref={spreadElRef} className="w-full overflow-hidden rounded-md" />
      </div>
    </div>
  )
}
