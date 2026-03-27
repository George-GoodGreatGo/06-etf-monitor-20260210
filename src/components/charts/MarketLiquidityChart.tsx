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
import type { EquityBondPoint, LiquidityV5Point } from '@/utils/marketApi'

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
  equityBond?: EquityBondPoint[]
  className?: string
}

type HoverState = {
  t: UTCTimestamp
  date: string
  close?: number
  v5?: number
  ebPct?: number
}

function buildEma(points: LineData<Time>[], period: number): LineData<Time>[] {
  if (!points.length) return []
  const a = 2 / (period + 1)
  let prev: number | null = null
  const out: LineData<Time>[] = []
  for (const p of points) {
    const v = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null
    if (v == null) continue
    prev = prev == null ? v : a * v + (1 - a) * prev
    out.push({ time: p.time, value: prev })
  }
  return out
}

export default function MarketLiquidityChart({ series, equityBond, className }: Props) {
  const priceElRef = useRef<HTMLDivElement | null>(null)
  const v5ElRef = useRef<HTMLDivElement | null>(null)
  const ebElRef = useRef<HTMLDivElement | null>(null)
  const v5OverboughtBgRef = useRef<HTMLDivElement | null>(null)
  const v5OversoldBgRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)

  const chartsRef = useRef<{ price: IChartApi | null; v5: IChartApi | null; eb: IChartApi | null }>({
    price: null,
    v5: null,
    eb: null,
  })
  const seriesRef = useRef<{
    hs300: ISeriesApi<'Line', Time> | null
    ema20: ISeriesApi<'Line', Time> | null
    ema60: ISeriesApi<'Line', Time> | null
    v5: ISeriesApi<'Line', Time> | null
    v5Align: ISeriesApi<'Line', Time> | null
    eb: ISeriesApi<'Line', Time> | null
    ebAlign: ISeriesApi<'Line', Time> | null
  }>({ hs300: null, ema20: null, ema60: null, v5: null, v5Align: null, eb: null, ebAlign: null })
  const hsSegRef = useRef<{ hot: ISeriesApi<'Line', Time>[]; cold: ISeriesApi<'Line', Time>[] }>({
    hot: [],
    cold: [],
  })
  const [hover, setHover] = useState<HoverState | null>(null)
  const [showEma20, setShowEma20] = useState(true)
  const [showEma60, setShowEma60] = useState(true)

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
    const hsHotSegments: LineData<Time>[][] = []
    const hsColdSegments: LineData<Time>[][] = []
    const v5: LineData<Time>[] = []
    const eb: LineData<Time>[] = []
    const map = new Map<UTCTimestamp, HoverState>()
    let hotBuf: LineData<Time>[] = []
    let coldBuf: LineData<Time>[] = []

    const ebByDate = new Map<string, number>()
    for (const p of equityBond || []) {
      const d = String(p?.date || '').trim()
      const v = typeof p?.pct === 'number' && Number.isFinite(p.pct) ? p.pct : null
      if (d && v != null) ebByDate.set(d, v)
    }

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      hs.push({ time: t, value: p.close })
      const v = typeof p.v5 === 'number' && Number.isFinite(p.v5) ? p.v5 : null
      if (v != null && v >= 70) {
        hotBuf.push({ time: t, value: p.close })
      } else if (hotBuf.length) {
        hsHotSegments.push(hotBuf)
        hotBuf = []
      }
      if (v != null && v <= 30) {
        coldBuf.push({ time: t, value: p.close })
      } else if (coldBuf.length) {
        hsColdSegments.push(coldBuf)
        coldBuf = []
      }
      if (typeof p.v5 === 'number' && Number.isFinite(p.v5)) {
        v5.push({ time: t, value: p.v5 })
      }
      const ebPct = ebByDate.get(p.date)
      if (typeof ebPct === 'number' && Number.isFinite(ebPct)) {
        eb.push({ time: t, value: ebPct })
      }
      map.set(t, {
        t,
        date: p.date,
        close: p.close,
        v5: typeof p.v5 === 'number' && Number.isFinite(p.v5) ? p.v5 : undefined,
        ebPct: typeof ebPct === 'number' && Number.isFinite(ebPct) ? ebPct : undefined,
      })
    }

    if (hotBuf.length) hsHotSegments.push(hotBuf)
    if (coldBuf.length) hsColdSegments.push(coldBuf)

    const ema20 = buildEma(hs, 20)
    const ema60 = buildEma(hs, 60)

    return { hs, hsHotSegments, hsColdSegments, ema20, ema60, v5, eb, map }
  }, [equityBond, series])

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

    const ema20 = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    const ema60 = chart.addSeries(LineSeries, {
      color: '#A78BFA',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    chartsRef.current.price = chart
    seriesRef.current.hs300 = hs
    seriesRef.current.ema20 = ema20
    seriesRef.current.ema60 = ema60

    return () => {
      chart.remove()
      if (chartsRef.current.price === chart) chartsRef.current.price = null
      seriesRef.current.hs300 = null
      seriesRef.current.ema20 = null
      seriesRef.current.ema60 = null
      hsSegRef.current.hot = []
      hsSegRef.current.cold = []
    }
  }, [])

  useEffect(() => {
    seriesRef.current.ema20?.applyOptions({ visible: showEma20 })
  }, [showEma20])

  useEffect(() => {
    seriesRef.current.ema60?.applyOptions({ visible: showEma60 })
  }, [showEma60])

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
        visible: false,
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
    if (!ebElRef.current || chartsRef.current.eb) return

    const chart = createChart(ebElRef.current, {
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

    const eb = chart.addSeries(LineSeries, {
      color: '#A78BFA',
      lineWidth: 2,
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

    chartsRef.current.eb = chart
    seriesRef.current.eb = eb
    seriesRef.current.ebAlign = align

    return () => {
      chart.remove()
      if (chartsRef.current.eb === chart) chartsRef.current.eb = null
      seriesRef.current.eb = null
      seriesRef.current.ebAlign = null
    }
  }, [])

  useEffect(() => {
    const price = chartsRef.current.price
    const v5 = chartsRef.current.v5
    const eb = chartsRef.current.eb
    if (!price || !v5 || !eb) return

    const charts: IChartApi[] = [price, v5, eb]

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
      const ebSeries = seriesRef.current.eb
      const h = data.map.get(t)

      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        if (c === price && hsSeries && typeof h?.close === 'number') {
          c.setCrosshairPosition(h.close, t, hsSeries)
        } else if (c === v5 && v5Series && typeof h?.v5 === 'number') {
          c.setCrosshairPosition(h.v5, t, v5Series)
        } else if (c === eb && ebSeries && typeof h?.ebPct === 'number') {
          c.setCrosshairPosition(h.ebPct, t, ebSeries)
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
    seriesRef.current.ema20?.setData(data.ema20)
    seriesRef.current.ema60?.setData(data.ema60)
    seriesRef.current.v5?.setData(data.v5)
    seriesRef.current.v5Align?.setData(data.hs)
    seriesRef.current.eb?.setData(data.eb)
    seriesRef.current.ebAlign?.setData(data.hs)
    const price = chartsRef.current.price
    const v5 = chartsRef.current.v5
    const eb = chartsRef.current.eb
    if (!price || !v5 || !eb) return

    for (const s of hsSegRef.current.hot) price.removeSeries(s)
    for (const s of hsSegRef.current.cold) price.removeSeries(s)
    hsSegRef.current.hot = []
    hsSegRef.current.cold = []

    for (const seg of data.hsHotSegments) {
      const s = price.addSeries(LineSeries, {
        color: '#F87171',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      s.setData(seg)
      hsSegRef.current.hot.push(s)
    }
    for (const seg of data.hsColdSegments) {
      const s = price.addSeries(LineSeries, {
        color: '#34D399',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      s.setData(seg)
      hsSegRef.current.cold.push(s)
    }

    price.timeScale().fitContent()
    const range = price.timeScale().getVisibleLogicalRange()
    if (range) v5.timeScale().setVisibleLogicalRange(range)
    if (range) eb.timeScale().setVisibleLogicalRange(range)
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
            <div className="text-[#A9B6CC]">股债分位</div>
            <div className="text-right font-mono">{fmt(hover.ebPct, 1)}</div>
          </div>
        </div>
      ) : null}

      <div className="pt-6">
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-2 z-20">
            <div className="inline-flex items-center gap-2 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
              沪深300（主图）
            </div>
          </div>
          <div className="absolute left-3 top-8 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEma20((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-semibold transition',
                showEma20 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
              )}
            >
              <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
              EMA20
            </button>
            <button
              type="button"
              onClick={() => setShowEma60((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-semibold transition',
                showEma60 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
              )}
            >
              <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
              EMA60
            </button>
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
        <div className="relative h-[140px] w-full border-t border-white/10">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            股债性价比（分位）
          </div>
          <div ref={ebElRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}

