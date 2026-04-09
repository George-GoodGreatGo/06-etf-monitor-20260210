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
import { LOWVOL_THRESH } from '@/utils/lowVolSignal'

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

type HoverState = {
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
  const [hover, setHover] = useState<HoverState | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [showMa250, setShowMa250] = useState(true)
  const [showBiasPane, setShowBiasPane] = useState(true)
  const [showBiasPctPane, setShowBiasPctPane] = useState(true)
  const [showSpreadPane, setShowSpreadPane] = useState(true)
  const [showSpreadPctPane, setShowSpreadPctPane] = useState(true)

  const mainElRef = useRef<HTMLDivElement | null>(null)
  const biasElRef = useRef<HTMLDivElement | null>(null)
  const biasPctElRef = useRef<HTMLDivElement | null>(null)
  const spreadElRef = useRef<HTMLDivElement | null>(null)
  const spreadPctElRef = useRef<HTMLDivElement | null>(null)
  const spreadPctCheapBgRef = useRef<HTMLDivElement | null>(null)
  const spreadPctExpBgRef = useRef<HTMLDivElement | null>(null)

  const chartsRef = useRef<{
    main: IChartApi | null
    bias: IChartApi | null
    biasPct: IChartApi | null
    spread: IChartApi | null
    spreadPct: IChartApi | null
  }>({ main: null, bias: null, biasPct: null, spread: null, spreadPct: null })

  const seriesRef = useRef<{
    mainClose: ISeriesApi<'Line', Time> | null
    mainMa: ISeriesApi<'Line', Time> | null
    bias: ISeriesApi<'Line', Time> | null
    biasAlign: ISeriesApi<'Line', Time> | null
    biasPct: ISeriesApi<'Line', Time> | null
    biasPctAlign: ISeriesApi<'Line', Time> | null
    spread: ISeriesApi<'Line', Time> | null
    spreadAlign: ISeriesApi<'Line', Time> | null
    spreadPct: ISeriesApi<'Line', Time> | null
    spreadPctAlign: ISeriesApi<'Line', Time> | null
  }>({
    mainClose: null,
    mainMa: null,
    bias: null,
    biasAlign: null,
    biasPct: null,
    biasPctAlign: null,
    spread: null,
    spreadAlign: null,
    spreadPct: null,
    spreadPctAlign: null,
  })

  const mainSegRef = useRef<Array<ISeriesApi<'Line', Time>>>([])

  const syncingRef = useRef(false)
  const initViewKeyRef = useRef('')

  const signal = useMemo(() => {
    const spreadPctRank10y = hover?.spreadPctRank10y
    const biasPct3y = hover?.biasPct
    if (typeof spreadPctRank10y !== 'number' || !Number.isFinite(spreadPctRank10y)) return null

    const cheap = spreadPctRank10y >= LOWVOL_THRESH.spreadCheapPctRank10y
    const lowBias =
      typeof biasPct3y === 'number' && Number.isFinite(biasPct3y) ? biasPct3y <= LOWVOL_THRESH.biasLowPct3y : false
    const highBias =
      typeof biasPct3y === 'number' && Number.isFinite(biasPct3y) ? biasPct3y >= LOWVOL_THRESH.biasHighPct3y : false

    if (highBias) return { label: '偏减仓', tone: 'bad' as const }
    if (cheap && lowBias) return { label: '偏配置', tone: 'good' as const }
    if (cheap) return { label: '偏配置（等待更好位置）', tone: 'mid' as const }
    return { label: '偏观望', tone: 'neutral' as const }
  }, [hover?.biasPct, hover?.spreadPctRank10y])

  const updateSpreadPctZones = () => {
    if (!showSpreadPctPane) return
    const chart = chartsRef.current.spreadPct
    const cheapBg = spreadPctCheapBgRef.current
    const expBg = spreadPctExpBgRef.current
    const metric = seriesRef.current.spreadPct as unknown as { priceToCoordinate?: (price: number) => number | null } | null
    if (!chart || !cheapBg || !expBg || !metric?.priceToCoordinate) return

    const y100 = metric.priceToCoordinate(100)
    const y80 = metric.priceToCoordinate(80)
    const y20 = metric.priceToCoordinate(20)
    const y0 = metric.priceToCoordinate(0)
    if (y100 == null || y80 == null || y20 == null || y0 == null) return

    const cheapTop = Math.min(y100, y80)
    const cheapBottom = Math.max(y100, y80)
    cheapBg.style.top = `${cheapTop}px`
    cheapBg.style.height = `${Math.max(0, cheapBottom - cheapTop)}px`
    cheapBg.style.right = `${SCALE_MIN_WIDTH}px`

    const expTop = Math.min(y20, y0)
    const expBottom = Math.max(y20, y0)
    expBg.style.top = `${expTop}px`
    expBg.style.height = `${Math.max(0, expBottom - expTop)}px`
    expBg.style.right = `${SCALE_MIN_WIDTH}px`
  }

  const data = useMemo(() => {
    const close: LineData<Time>[] = []
    const ma: LineData<Time>[] = []
    const bias: LineData<Time>[] = []
    const biasPct: LineData<Time>[] = []
    const spreadSmooth: LineData<Time>[] = []
    const spreadPctRank10y: LineData<Time>[] = []
    const segBase: Array<{ time: UTCTimestamp; close: number; spreadPctRank10y?: number; biasPct3y?: number }> = []
    const allocStrongSegments: Array<LineData<Time>[]> = []
    const reduceStrongSegments: Array<LineData<Time>[]> = []
    const allocWeakSegments: Array<LineData<Time>[]> = []
    const map = new Map<UTCTimestamp, HoverState>()

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      if (typeof p.close === 'number' && Number.isFinite(p.close)) {
        close.push({ time: t, value: p.close })
        segBase.push({
          time: t,
          close: p.close,
          spreadPctRank10y: typeof p.spreadPctRank10y === 'number' && Number.isFinite(p.spreadPctRank10y) ? p.spreadPctRank10y : undefined,
          biasPct3y: typeof p.biasPct3y === 'number' && Number.isFinite(p.biasPct3y) ? p.biasPct3y : undefined,
        })
      }
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

    segBase.sort((a, b) => a.time - b.time)

    type SegState = 'allocStrong' | 'reduceStrong' | 'allocWeak' | null
    const classify = (p: { spreadPctRank10y?: number; biasPct3y?: number }): SegState => {
      const spread = p.spreadPctRank10y
      if (typeof spread !== 'number' || !Number.isFinite(spread)) return null
      const bias = p.biasPct3y
      const cheap = spread >= LOWVOL_THRESH.spreadCheapPctRank10y
      const lowBias = typeof bias === 'number' && Number.isFinite(bias) ? bias <= LOWVOL_THRESH.biasLowPct3y : false
      const highBias = typeof bias === 'number' && Number.isFinite(bias) ? bias >= LOWVOL_THRESH.biasHighPct3y : false
      if (highBias) return 'reduceStrong'
      if (cheap && lowBias) return 'allocStrong'
      if (cheap) return 'allocWeak'
      return null
    }

    let buf: LineData<Time>[] = []
    let bufState: SegState = null
    const flush = () => {
      if (!buf.length || !bufState) {
        buf = []
        bufState = null
        return
      }
      if (bufState === 'allocStrong') allocStrongSegments.push(buf)
      else if (bufState === 'reduceStrong') reduceStrongSegments.push(buf)
      else if (bufState === 'allocWeak') allocWeakSegments.push(buf)
      buf = []
      bufState = null
    }

    for (const p of segBase) {
      const st = classify(p)
      if (!st) {
        flush()
        continue
      }
      const pt: LineData<Time> = { time: p.time, value: p.close }
      if (bufState && bufState !== st) flush()
      bufState = st
      buf.push(pt)
    }
    flush()

    return { close, ma, bias, biasPct, spreadSmooth, spreadPctRank10y, allocStrongSegments, reduceStrongSegments, allocWeakSegments, map }
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
      color: '#94A3B8',
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
    const el = biasElRef.current
    if (!el || chartsRef.current.bias) return

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

    const metric = chart.addSeries(LineSeries, {
      color: '#60A5FA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 4) },
    })

    const align = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    align.applyOptions({ visible: false })

    chartsRef.current.bias = chart
    seriesRef.current.bias = metric
    seriesRef.current.biasAlign = align

    return () => {
      chart.remove()
      if (chartsRef.current.bias === chart) chartsRef.current.bias = null
      seriesRef.current.bias = null
      seriesRef.current.biasAlign = null
    }
  }, [])

  useEffect(() => {
    const el = biasPctElRef.current
    if (!el || chartsRef.current.biasPct) return

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

    const metric = chart.addSeries(LineSeries, {
      color: '#60A5FA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 1) },
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })

    const align = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    align.applyOptions({ visible: false })

    chartsRef.current.biasPct = chart
    seriesRef.current.biasPct = metric
    seriesRef.current.biasPctAlign = align

    return () => {
      chart.remove()
      if (chartsRef.current.biasPct === chart) chartsRef.current.biasPct = null
      seriesRef.current.biasPct = null
      seriesRef.current.biasPctAlign = null
    }
  }, [])

  useEffect(() => {
    const el = spreadElRef.current
    if (!el || chartsRef.current.spread) return

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

    chartsRef.current.spread = chart
    seriesRef.current.spread = metric
    seriesRef.current.spreadAlign = align

    return () => {
      chart.remove()
      if (chartsRef.current.spread === chart) chartsRef.current.spread = null
      seriesRef.current.spread = null
      seriesRef.current.spreadAlign = null
    }
  }, [])

  useEffect(() => {
    const el = spreadPctElRef.current
    if (!el || chartsRef.current.spreadPct) return

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
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 1) },
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })

    const align = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    align.applyOptions({ visible: false })

    chartsRef.current.spreadPct = chart
    seriesRef.current.spreadPct = metric
    seriesRef.current.spreadPctAlign = align
    const onRange = () => {
      requestAnimationFrame(updateSpreadPctZones)
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      chart.remove()
      if (chartsRef.current.spreadPct === chart) chartsRef.current.spreadPct = null
      seriesRef.current.spreadPct = null
      seriesRef.current.spreadPctAlign = null
    }
  }, [])

  useEffect(() => {
    const main = chartsRef.current.main
    const bias = chartsRef.current.bias
    const biasPct = chartsRef.current.biasPct
    const spread = chartsRef.current.spread
    const spreadPct = chartsRef.current.spreadPct
    if (!main) return

    const charts: IChartApi[] = [main]
    if (showBiasPane && bias) charts.push(bias)
    if (showBiasPctPane && biasPct) charts.push(biasPct)
    if (showSpreadPane && spread) charts.push(spread)
    if (showSpreadPctPane && spreadPct) charts.push(spreadPct)
    if (charts.length <= 1) return

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
      const biasSeries = seriesRef.current.bias
      const biasPctSeries = seriesRef.current.biasPct
      const spreadSeries = seriesRef.current.spread
      const spreadPctSeries = seriesRef.current.spreadPct

      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        if (c === main && mainClose && typeof h?.close === 'number') {
          c.setCrosshairPosition(h.close, t, mainClose)
        } else if (c === bias && biasSeries && typeof h?.bias === 'number') {
          c.setCrosshairPosition(h.bias, t, biasSeries)
        } else if (c === biasPct && biasPctSeries && typeof h?.biasPct === 'number') {
          c.setCrosshairPosition(h.biasPct, t, biasPctSeries)
        } else if (c === spread && spreadSeries && typeof h?.spreadSmooth === 'number') {
          c.setCrosshairPosition(h.spreadSmooth, t, spreadSeries)
        } else if (c === spreadPct && spreadPctSeries && typeof h?.spreadPctRank10y === 'number') {
          c.setCrosshairPosition(h.spreadPctRank10y, t, spreadPctSeries)
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
  }, [data.map, showBiasPane, showBiasPctPane, showSpreadPane, showSpreadPctPane])

  useEffect(() => {
    seriesRef.current.mainClose?.setData(data.close)
    seriesRef.current.mainMa?.setData(showMa250 ? data.ma : [])
    seriesRef.current.bias?.setData(showBiasPane ? data.bias : [])
    seriesRef.current.biasAlign?.setData(data.close)
    seriesRef.current.biasPct?.setData(showBiasPctPane ? data.biasPct : [])
    seriesRef.current.biasPctAlign?.setData(data.close)
    seriesRef.current.spread?.setData(showSpreadPane ? data.spreadSmooth : [])
    seriesRef.current.spreadAlign?.setData(data.close)
    seriesRef.current.spreadPct?.setData(showSpreadPctPane ? data.spreadPctRank10y : [])
    seriesRef.current.spreadPctAlign?.setData(data.close)

    const main = chartsRef.current.main
    const bias = chartsRef.current.bias
    const biasPct = chartsRef.current.biasPct
    const spread = chartsRef.current.spread
    const spreadPct = chartsRef.current.spreadPct
    if (!main || !bias || !biasPct || !spread || !spreadPct) return

    for (const s of mainSegRef.current) main.removeSeries(s)
    mainSegRef.current = []
    const addSeg = (seg: LineData<Time>[], color: string) => {
      const s = main.addSeries(LineSeries, {
        color,
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      s.setData(seg)
      mainSegRef.current.push(s)
    }
    for (const seg of data.allocStrongSegments) addSeg(seg, '#34D399')
    for (const seg of data.reduceStrongSegments) addSeg(seg, '#F87171')
    for (const seg of data.allocWeakSegments) addSeg(seg, '#FBBF24')

    const visiblePanes: Array<'bias' | 'biasPct' | 'spread' | 'spreadPct'> = []
    if (showBiasPane) visiblePanes.push('bias')
    if (showBiasPctPane) visiblePanes.push('biasPct')
    if (showSpreadPane) visiblePanes.push('spread')
    if (showSpreadPctPane) visiblePanes.push('spreadPct')
    const lastPane = visiblePanes.length ? visiblePanes[visiblePanes.length - 1] : null
    main.applyOptions({ timeScale: { visible: lastPane == null } })
    bias.applyOptions({ timeScale: { visible: lastPane === 'bias' } })
    biasPct.applyOptions({ timeScale: { visible: lastPane === 'biasPct' } })
    spread.applyOptions({ timeScale: { visible: lastPane === 'spread' } })
    spreadPct.applyOptions({ timeScale: { visible: lastPane === 'spreadPct' } })

    const key = data.close.length ? `${data.close.length}:${String(data.close[data.close.length - 1]?.time ?? '')}` : ''
    if (key && initViewKeyRef.current !== key) {
      initViewKeyRef.current = key
      const total = data.close.length
      const to = Math.max(0, total - 1)
      const from = total > 720 ? total - 720 : 0
      main.timeScale().setVisibleLogicalRange({ from, to })
    }

    const range = main.timeScale().getVisibleLogicalRange()
    if (range) {
      if (showBiasPane) bias.timeScale().setVisibleLogicalRange(range)
      if (showBiasPctPane) biasPct.timeScale().setVisibleLogicalRange(range)
      if (showSpreadPane) spread.timeScale().setVisibleLogicalRange(range)
      if (showSpreadPctPane) spreadPct.timeScale().setVisibleLogicalRange(range)
    }
    requestAnimationFrame(updateSpreadPctZones)
  }, [data, showBiasPane, showBiasPctPane, showMa250, showSpreadPane, showSpreadPctPane])

  useEffect(() => {
    if (!showSpreadPctPane || !spreadPctElRef.current) return
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            requestAnimationFrame(updateSpreadPctZones)
          })
    if (ro) ro.observe(spreadPctElRef.current)
    requestAnimationFrame(updateSpreadPctZones)
    return () => ro?.disconnect()
  }, [showSpreadPctPane])

  return (
    <div className={cn('relative', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B6CC]">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showInfo ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#A9B6CC]" />
          说明
        </button>
        <button
          type="button"
          onClick={() => setShowMa250((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showMa250 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
          MA250
        </button>
        <div className="mx-2 h-4 w-px bg-white/10" />
        <button
          type="button"
          onClick={() => setShowBiasPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showBiasPane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#60A5FA]" />
          BIAS
        </button>
        <button
          type="button"
          onClick={() => setShowBiasPctPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showBiasPctPane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#60A5FA]" />
          BIAS分位
        </button>
        <button
          type="button"
          onClick={() => setShowSpreadPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showSpreadPane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
          利差(平滑)
        </button>
        <button
          type="button"
          onClick={() => setShowSpreadPctPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showSpreadPctPane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
          利差分位
        </button>
      </div>

      {showInfo ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#A9B6CC]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="text-[#E6EDF7]">建议规则</div>
            <div>
              <span className="mr-2 rounded bg-[rgba(16,185,129,0.18)] px-2 py-[2px] font-mono text-[11px] text-[#34D399]">偏配置</span>
              利差分位(10年) ≥ 80 且 BIAS分位(3年) ≤ 20
            </div>
            <div>
              <span className="mr-2 rounded bg-[rgba(239,68,68,0.18)] px-2 py-[2px] font-mono text-[11px] text-[#F87171]">偏减仓</span>
              BIAS分位(3年) ≥ 85
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="text-[#E6EDF7]">指标定义</div>
            <div>股息收益率（修正）：滚动1年推算分红点数D，对D做250日SMA后除以PRI</div>
            <div>利差（核心）：股息收益率(修正)-10Y</div>
            <div>利差分位：核心利差的10年滚动分位（window≈2520，minPeriods=252）</div>
          </div>
        </div>
      ) : null}

      {hover ? (
        <div className="pointer-events-none absolute right-3 top-[92px] z-10 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
          <div className="font-mono text-[11px] text-[#A9B6CC]">{hover.date}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            {signal ? (
              <>
                <div className="text-[#A9B6CC]">建议</div>
                <div className="text-right">
                  <span
                    className={cn(
                      'rounded px-2 py-[2px] font-mono text-[11px]',
                      signal.tone === 'good'
                        ? 'bg-[rgba(16,185,129,0.22)] text-[#34D399]'
                        : signal.tone === 'bad'
                          ? 'bg-[rgba(239,68,68,0.22)] text-[#F87171]'
                          : signal.tone === 'mid'
                            ? 'bg-[rgba(245,158,11,0.18)] text-[#FBBF24]'
                            : 'bg-white/10 text-[#E6EDF7]',
                    )}
                  >
                    {signal.label}
                  </span>
                </div>
              </>
            ) : null}
            <div className="text-[#A9B6CC]">指数</div>
            <div className="text-right font-mono">{fmt(hover.close, 2)}</div>
            {showMa250 ? (
              <>
                <div className="text-[#A9B6CC]">MA250</div>
                <div className="text-right font-mono">{fmt(hover.ma250, 2)}</div>
              </>
            ) : null}
            {showBiasPane ? (
              <>
                <div className="text-[#A9B6CC]">BIAS(250)</div>
                <div className="text-right font-mono">{fmt(hover.bias, 4)}</div>
              </>
            ) : null}
            {showBiasPctPane ? (
              <>
                <div className="text-[#A9B6CC]">BIAS分位(3年)</div>
                <div className="text-right font-mono">{fmt(hover.biasPct, 1)}</div>
              </>
            ) : null}
            {showSpreadPane ? (
              <>
                <div className="text-[#A9B6CC]">利差（核心）</div>
                <div className="text-right font-mono">{fmt(hover.spreadSmooth, 2)}</div>
              </>
            ) : null}
            {showSpreadPctPane ? (
              <>
                <div className="text-[#A9B6CC]">利差分位(10年)</div>
                <div className="text-right font-mono">{fmt(hover.spreadPctRank10y, 1)}</div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="relative rounded-lg border border-white/10 bg-[#111B2E] pt-6">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            指数（主图）{showMa250 ? ' + MA250' : ''}
          </div>
          <div ref={mainElRef} className="h-[300px] w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showBiasPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showBiasPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            BIAS(250)
          </div>
          <div ref={biasElRef} className="relative z-10 h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showBiasPctPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showBiasPctPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            BIAS分位(3年)
          </div>
          <div ref={biasPctElRef} className="relative z-10 h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showSpreadPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showSpreadPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            利差（核心）
          </div>
          <div ref={spreadElRef} className="relative z-10 h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showSpreadPctPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showSpreadPctPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            利差分位(10年)
          </div>
          <div
            ref={spreadPctCheapBgRef}
            className="pointer-events-none absolute left-0 z-20 bg-[rgba(16,185,129,0.14)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div
            ref={spreadPctExpBgRef}
            className="pointer-events-none absolute left-0 z-20 bg-[rgba(239,68,68,0.14)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div ref={spreadPctElRef} className="relative z-10 h-full w-full" />
        </div>
      </div>
    </div>
  )
}
