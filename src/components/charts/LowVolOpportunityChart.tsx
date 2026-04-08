import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import type { LowVolH30269Point } from '@/utils/marketApi'

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

type SubView = 'bias' | 'biasPct' | 'spreadSmooth' | 'spreadPctRank10y'

type Hover = {
  t: UTCTimestamp
  date: string
  close?: number
  ma250?: number
  bias?: number
  biasPct?: number
  spreadSmooth?: number
  spreadPctRank10y?: number
}

type Props = {
  series: LowVolH30269Point[]
  className?: string
}

export default function LowVolOpportunityChart({ series, className }: Props) {
  const [subView, setSubView] = useState<SubView>('spreadSmooth')
  const [hover, setHover] = useState<Hover | null>(null)

  const mainElRef = useRef<HTMLDivElement | null>(null)
  const subElRef = useRef<HTMLDivElement | null>(null)

  const chartsRef = useRef<{ main: IChartApi | null; sub: IChartApi | null }>({ main: null, sub: null })
  const seriesRef = useRef<{
    mainClose: ISeriesApi<'Line', Time> | null
    mainMa: ISeriesApi<'Line', Time> | null
    subMetric: ISeriesApi<'Line', Time> | null
    subAlign: ISeriesApi<'Line', Time> | null
  }>({ mainClose: null, mainMa: null, subMetric: null, subAlign: null })

  const syncingRef = useRef(false)
  const initViewKeyRef = useRef('')

  const data = useMemo(() => {
    const close: LineData<Time>[] = []
    const ma: LineData<Time>[] = []
    const bias: LineData<Time>[] = []
    const biasPct: LineData<Time>[] = []
    const spreadSmooth: LineData<Time>[] = []
    const spreadPctRank10y: LineData<Time>[] = []
    const map = new Map<UTCTimestamp, Hover>()

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      if (typeof p.close === 'number' && Number.isFinite(p.close)) close.push({ time: t, value: p.close })
      if (typeof p.ma250 === 'number' && Number.isFinite(p.ma250)) ma.push({ time: t, value: p.ma250 })
      if (typeof p.bias250 === 'number' && Number.isFinite(p.bias250)) bias.push({ time: t, value: p.bias250 })
      if (typeof p.biasPct3y === 'number' && Number.isFinite(p.biasPct3y)) biasPct.push({ time: t, value: p.biasPct3y })
      if (typeof p.spreadSmoothPct === 'number' && Number.isFinite(p.spreadSmoothPct)) spreadSmooth.push({ time: t, value: p.spreadSmoothPct })
      if (typeof p.spreadPctRank10y === 'number' && Number.isFinite(p.spreadPctRank10y))
        spreadPctRank10y.push({ time: t, value: p.spreadPctRank10y })

      map.set(t, {
        t,
        date: p.date,
        close: typeof p.close === 'number' && Number.isFinite(p.close) ? p.close : undefined,
        ma250: typeof p.ma250 === 'number' && Number.isFinite(p.ma250) ? p.ma250 : undefined,
        bias: typeof p.bias250 === 'number' && Number.isFinite(p.bias250) ? p.bias250 : undefined,
        biasPct: typeof p.biasPct3y === 'number' && Number.isFinite(p.biasPct3y) ? p.biasPct3y : undefined,
        spreadSmooth: typeof p.spreadSmoothPct === 'number' && Number.isFinite(p.spreadSmoothPct) ? p.spreadSmoothPct : undefined,
        spreadPctRank10y:
          typeof p.spreadPctRank10y === 'number' && Number.isFinite(p.spreadPctRank10y) ? p.spreadPctRank10y : undefined,
      })
    }

    close.sort((a, b) => (a.time as number) - (b.time as number))
    ma.sort((a, b) => (a.time as number) - (b.time as number))
    bias.sort((a, b) => (a.time as number) - (b.time as number))
    biasPct.sort((a, b) => (a.time as number) - (b.time as number))
    spreadSmooth.sort((a, b) => (a.time as number) - (b.time as number))
    spreadPctRank10y.sort((a, b) => (a.time as number) - (b.time as number))

    return { close, ma, bias, biasPct, spreadSmooth, spreadPctRank10y, map }
  }, [series])

  useEffect(() => {
    const el = mainElRef.current
    if (!el || chartsRef.current.main) return

    const chart = createChart(el, {
      autoSize: true,
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
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

    const closeSeries = chart.addSeries(LineSeries, {
      color: '#60A5FA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    const maSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.65)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    chartsRef.current.main = chart
    seriesRef.current.mainClose = closeSeries
    seriesRef.current.mainMa = maSeries

    return () => {
      chart.remove()
      if (chartsRef.current.main === chart) chartsRef.current.main = null
      seriesRef.current.mainClose = null
      seriesRef.current.mainMa = null
    }
  }, [])

  useEffect(() => {
    const el = subElRef.current
    if (!el || chartsRef.current.sub) return

    const chart = createChart(el, {
      autoSize: true,
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
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

    const metric = chart.addSeries(LineSeries, {
      color: '#A78BFA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    const align = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    align.applyOptions({ visible: false })

    chartsRef.current.sub = chart
    seriesRef.current.subMetric = metric
    seriesRef.current.subAlign = align

    return () => {
      chart.remove()
      if (chartsRef.current.sub === chart) chartsRef.current.sub = null
      seriesRef.current.subMetric = null
      seriesRef.current.subAlign = null
    }
  }, [])

  useEffect(() => {
    const main = chartsRef.current.main
    const sub = chartsRef.current.sub
    if (!main || !sub) return

    const charts: IChartApi[] = [main, sub]

    const onVisibleLogicalRange = (src: IChartApi) => (range: LogicalRange | null) => {
      if (syncingRef.current) return
      if (!range) return
      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        c.timeScale().setVisibleLogicalRange(range)
      }
      syncingRef.current = false
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
        return
      }

      const h = data.map.get(t) ?? null
      setHover(h)

      const mainClose = seriesRef.current.mainClose
      const subMetric = seriesRef.current.subMetric
      const v =
        subView === 'bias'
          ? h?.bias
          : subView === 'biasPct'
            ? h?.biasPct
            : subView === 'spreadSmooth'
              ? h?.spreadSmooth
              : h?.spreadPctRank10y

      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        if (c === main && mainClose && typeof h?.close === 'number') {
          c.setCrosshairPosition(h.close, t, mainClose)
        } else if (c === sub && subMetric && typeof v === 'number') {
          c.setCrosshairPosition(v, t, subMetric)
        } else {
          c.clearCrosshairPosition()
        }
      }
      syncingRef.current = false
    }

    const rangeHandlers = charts.map((c) => ({ chart: c, fn: onVisibleLogicalRange(c) }))
    for (const { chart, fn } of rangeHandlers) chart.timeScale().subscribeVisibleLogicalRangeChange(fn)

    const crossHandlers = charts.map((c) => ({ chart: c, fn: onCrosshair(c) }))
    for (const { chart, fn } of crossHandlers) chart.subscribeCrosshairMove(fn)

    return () => {
      for (const { chart, fn } of rangeHandlers) chart.timeScale().unsubscribeVisibleLogicalRangeChange(fn)
      for (const { chart, fn } of crossHandlers) chart.unsubscribeCrosshairMove(fn)
    }
  }, [data.map, subView])

  useEffect(() => {
    seriesRef.current.mainClose?.setData(data.close)
    seriesRef.current.mainMa?.setData(data.ma)

    const metricSeries = seriesRef.current.subMetric
    if (metricSeries) {
      if (subView === 'bias') metricSeries.setData(data.bias)
      else if (subView === 'biasPct') metricSeries.setData(data.biasPct)
      else if (subView === 'spreadSmooth') metricSeries.setData(data.spreadSmooth)
      else metricSeries.setData(data.spreadPctRank10y)
    }
    seriesRef.current.subAlign?.setData(data.close)

    const subChart = chartsRef.current.sub
    if (subChart) {
      if (subView === 'biasPct' || subView === 'spreadPctRank10y') {
        metricSeries?.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
          priceFormat: { type: 'custom', formatter: (v) => fmt(v, 1) },
        })
      } else if (subView === 'bias') {
        metricSeries?.applyOptions({
          autoscaleInfoProvider: undefined,
          priceFormat: { type: 'custom', formatter: (v) => fmt(v, 4) },
        })
      } else {
        metricSeries?.applyOptions({
          autoscaleInfoProvider: undefined,
          priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
        })
      }
    }

    const main = chartsRef.current.main
    const sub = chartsRef.current.sub
    if (!main || !sub) return

    const key = data.close.length ? `${data.close.length}:${String(data.close[data.close.length - 1]?.time ?? '')}` : ''
    if (key && initViewKeyRef.current !== key) {
      initViewKeyRef.current = key
      const total = data.close.length
      const to = Math.max(0, total - 1)
      const from = total > 720 ? total - 720 : 0
      main.timeScale().setVisibleLogicalRange({ from, to })
    }

    const range = main.timeScale().getVisibleLogicalRange()
    if (range) sub.timeScale().setVisibleLogicalRange(range)
  }, [data, subView])

  const subTitle = subView === 'bias' ? 'BIAS(250)' : subView === 'biasPct' ? 'BIAS分位(3年)' : subView === 'spreadSmooth' ? '利差（平滑）' : '利差分位(10年)'
  const subUnit = subView === 'bias' ? '' : subView === 'biasPct' ? '%' : subView === 'spreadSmooth' ? '%' : '%'
  const subValue =
    subView === 'bias'
      ? hover?.bias
      : subView === 'biasPct'
        ? hover?.biasPct
        : subView === 'spreadSmooth'
          ? hover?.spreadSmooth
          : hover?.spreadPctRank10y

  return (
    <div className={cn('relative overflow-hidden rounded border border-white/10 bg-[#111B2E]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="text-xs font-semibold text-white">指数点位</div>
        <div className="text-xs text-[#A9B6CC]">
          {hover ? hover.date : '—'} · {fmt(hover?.close ?? null, 2)} 点 · MA250 {fmt(hover?.ma250 ?? null, 2)}
        </div>
      </div>
      <div ref={mainElRef} className="h-[300px] w-full" />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B6CC]">
          {(
            [
              { k: 'bias', label: 'BIAS(250)', dot: '#60A5FA' },
              { k: 'biasPct', label: 'BIAS分位', dot: '#60A5FA' },
              { k: 'spreadSmooth', label: '利差(平滑)', dot: '#A78BFA' },
              { k: 'spreadPctRank10y', label: '利差分位', dot: '#A78BFA' },
            ] as Array<{ k: SubView; label: string; dot: string }>
          ).map((b) => (
            <button
              key={b.k}
              type="button"
              onClick={() => setSubView(b.k)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
                subView === b.k ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: b.dot }} />
              {b.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-[#A9B6CC]">
          {subTitle} · {fmt(subValue ?? null, subView === 'bias' ? 4 : 2)}
          {subUnit ? ` ${subUnit}` : ''}
        </div>
      </div>
      <div ref={subElRef} className="h-[160px] w-full" />
    </div>
  )
}
