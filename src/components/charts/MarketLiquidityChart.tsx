import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import type { LiquidityV5Point } from '@/utils/marketApi'

const SCALE_MIN_WIDTH = 110

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
  const priceElRef = useRef<HTMLDivElement | null>(null)
  const v5ElRef = useRef<HTMLDivElement | null>(null)
  const v5OverboughtBgRef = useRef<HTMLDivElement | null>(null)
  const v5OversoldBgRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)

  const chartsRef = useRef<{ price: IChartApi | null; v5: IChartApi | null }>({ price: null, v5: null })
  const seriesRef = useRef<{
    hs300: ISeriesApi<'Line', Time> | null
    v5: ISeriesApi<'Line', Time> | null
    v5Align: ISeriesApi<'Line', Time> | null
  }>({ hs300: null, v5: null, v5Align: null })
  const [hover, setHover] = useState<HoverState | null>(null)

  const updateV5ZoneBg = () => {
    const el = v5ElRef.current
    const overEl = v5OverboughtBgRef.current
    const underEl = v5OversoldBgRef.current
    const s = seriesRef.current.v5
    if (!el || !overEl || !underEl || !s) return

    const h = el.clientHeight
    const y70 = s.priceToCoordinate(70)
    const y30 = s.priceToCoordinate(30)
    if (y70 == null || y30 == null) {
      overEl.style.display = 'none'
      underEl.style.display = 'none'
      return
    }
    overEl.style.display = 'block'
    underEl.style.display = 'block'

    const topY = Math.max(0, Math.min(h, y70))
    const bottomY = Math.max(0, Math.min(h, y30))

    overEl.style.top = '0px'
    overEl.style.height = `${topY}px`

    underEl.style.top = `${bottomY}px`
    underEl.style.height = `${Math.max(0, h - bottomY)}px`
  }

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
    if (!priceElRef.current || chartsRef.current.price) return

    const chart = createChart(priceElRef.current, {
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
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: false,
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
    chartsRef.current.price = chart
    seriesRef.current.hs300 = hs

    return () => {
      chart.remove()
      if (chartsRef.current.price === chart) chartsRef.current.price = null
      seriesRef.current.hs300 = null
    }
  }, [])

  useEffect(() => {
    if (!v5ElRef.current || chartsRef.current.v5) return

    const chart = createChart(v5ElRef.current, {
      autoSize: true,
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel: true,
        pinch: false,
      },
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
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })

    const v5 = chart.addSeries(LineSeries, {
      color: '#FF8A50',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 1) },
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: 0,
          maxValue: 100,
        },
      }),
    })

    const align = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    align.applyOptions({ visible: false })

    v5.createPriceLine({
      price: 30,
      color: 'rgba(16,185,129,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })
    v5.createPriceLine({
      price: 70,
      color: 'rgba(239,68,68,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })

    chartsRef.current.v5 = chart
    seriesRef.current.v5 = v5
    seriesRef.current.v5Align = align

    return () => {
      chart.remove()
      if (chartsRef.current.v5 === chart) chartsRef.current.v5 = null
      seriesRef.current.v5 = null
      seriesRef.current.v5Align = null
    }
  }, [])

  useEffect(() => {
    const price = chartsRef.current.price
    const v5 = chartsRef.current.v5
    if (!price || !v5) return

    const charts: IChartApi[] = [price, v5]

    const onVisibleLogicalRange = (src: IChartApi) => (range: LogicalRange | null) => {
      if (syncingRef.current) return
      if (!range) return
      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        c.timeScale().setVisibleLogicalRange(range)
      }
      syncingRef.current = false
      requestAnimationFrame(updateV5ZoneBg)
    }

    const onCrosshair = (src: IChartApi) => (param: { time?: Time } | null) => {
      if (syncingRef.current) return
      const t = normalizeTime(param?.time)
      if (!t) {
        setHover(null)
        syncingRef.current = true
        for (const c of charts) {
          if (c === src) continue
          c.clearCrosshairPosition()
        }
        syncingRef.current = false
        requestAnimationFrame(updateV5ZoneBg)
        return
      }

      setHover(data.map.get(t) ?? null)

      const hsSeries = seriesRef.current.hs300
      const v5Series = seriesRef.current.v5
      const h = data.map.get(t)

      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        if (c === price && hsSeries && typeof h?.close === 'number') {
          c.setCrosshairPosition(h.close, t, hsSeries)
        } else if (c === v5 && v5Series && typeof h?.v5 === 'number') {
          c.setCrosshairPosition(h.v5, t, v5Series)
        } else {
          c.clearCrosshairPosition()
        }
      }
      syncingRef.current = false
      requestAnimationFrame(updateV5ZoneBg)
    }

    const rangeHandlers: Array<{ chart: IChartApi; fn: (range: LogicalRange | null) => void }> = charts.map((c) => ({
      chart: c,
      fn: onVisibleLogicalRange(c),
    }))
    for (const { chart, fn } of rangeHandlers) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(fn)
    }

    const crossHandlers = charts.map((c) => ({ chart: c, fn: onCrosshair(c) }))
    for (const { chart, fn } of crossHandlers) {
      chart.subscribeCrosshairMove(fn)
    }

    const ro =
      typeof ResizeObserver === 'undefined' || !v5ElRef.current
        ? null
        : new ResizeObserver(() => {
            requestAnimationFrame(updateV5ZoneBg)
          })
    if (ro && v5ElRef.current) ro.observe(v5ElRef.current)

    return () => {
      for (const { chart, fn } of rangeHandlers) {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(fn)
      }
      for (const { chart, fn } of crossHandlers) {
        chart.unsubscribeCrosshairMove(fn)
      }
      ro?.disconnect()
    }
  }, [data.map])

  useEffect(() => {
    seriesRef.current.hs300?.setData(data.hs)
    seriesRef.current.v5?.setData(data.v5)
    seriesRef.current.v5Align?.setData(data.hs)
    const price = chartsRef.current.price
    const v5 = chartsRef.current.v5
    if (!price || !v5) return
    price.timeScale().fitContent()
    const range = price.timeScale().getVisibleLogicalRange()
    if (range) v5.timeScale().setVisibleLogicalRange(range)
    requestAnimationFrame(() => requestAnimationFrame(updateV5ZoneBg))
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

      <div className="pt-6">
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            沪深300（主图）
          </div>
          <div ref={priceElRef} className="h-[300px] w-full" />
        </div>
        <div className="relative h-[140px] w-full border-t border-white/10">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            A股市场流动性指数（V5）
          </div>
          <div
            ref={v5OverboughtBgRef}
            className="pointer-events-none absolute left-0 top-0 z-10 bg-[rgba(239,68,68,0.12)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div
            ref={v5OversoldBgRef}
            className="pointer-events-none absolute left-0 top-0 z-10 bg-[rgba(16,185,129,0.10)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div ref={v5ElRef} className="relative z-0 h-full w-full" />
        </div>
      </div>
    </div>
  )
}

