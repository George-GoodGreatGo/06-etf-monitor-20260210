import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { calcLowVolSuggestion, getLowVolThresh } from '@/utils/lowVolSignal'

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

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function hasValidLogicalRange(range: LogicalRange | null | undefined): range is LogicalRange {
  if (!range) return false
  const from = Number((range as { from?: unknown }).from)
  const to = Number((range as { to?: unknown }).to)
  return Number.isFinite(from) && Number.isFinite(to)
}

function safeSetVisibleLogicalRange(chart: IChartApi | null | undefined, range: LogicalRange | null | undefined): boolean {
  if (!chart || !hasValidLogicalRange(range)) return false
  try {
    chart.timeScale().setVisibleLogicalRange(range)
    return true
  } catch {
    return false
  }
}

function safeClearCrosshair(chart: IChartApi | null | undefined): boolean {
  if (!chart) return false
  try {
    chart.clearCrosshairPosition()
    return true
  } catch {
    return false
  }
}

function safeSetCrosshair(
  chart: IChartApi | null | undefined,
  price: number | undefined,
  time: UTCTimestamp | null,
  series: ISeriesApi<'Line', Time> | null | undefined,
): boolean {
  if (!chart || !series || !time || !isFiniteNumber(price)) return false
  try {
    chart.setCrosshairPosition(price, time, series)
    return true
  } catch {
    return false
  }
}

function safeSetTimeScaleVisible(chart: IChartApi | null | undefined, visible: boolean): boolean {
  if (!chart) return false
  try {
    chart.applyOptions({ timeScale: { visible } })
    return true
  } catch {
    return false
  }
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
  sma60?: number
  ma250?: number
  bias60?: number
  bias250?: number
  biasPct3y60?: number
  biasPct3y250?: number
  spreadSmooth?: number
  spreadPctRank10y?: number
}

type Props = {
  series: LowVolH30269Point[]
  indexCode?: string
  indexLabel?: string
  indexDesc?: string
  biasBasis: 'sma250' | 'sma60'
  metricMode?: 'dividend' | 'earnings'
  className?: string
}

export default function LowVolOpportunityChart({
  series,
  indexCode,
  indexLabel,
  indexDesc,
  biasBasis,
  metricMode = 'dividend',
  className,
}: Props) {
  const [hover, setHover] = useState<HoverState | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [showSma60, setShowSma60] = useState(true)
  const [showMa250, setShowMa250] = useState(true)
  const [showBiasPane, setShowBiasPane] = useState(true)
  const [showBiasPctPane, setShowBiasPctPane] = useState(true)
  const [showSpreadPane, setShowSpreadPane] = useState(true)
  const [showSpreadPctPane, setShowSpreadPctPane] = useState(true)

  const thresh = useMemo(() => getLowVolThresh(indexCode), [indexCode])
  const isValueTiming = metricMode === 'earnings'
  const isValue100 = isValueTiming && indexCode === '980081'
  const spreadCoreLabel = metricMode === 'earnings' ? '盈利收益率(=1/PE)-10Y' : '股息收益率(修正)-10Y'
  const metricDefinition =
    metricMode === 'earnings'
      ? '盈利收益率：按 1/PE 计算（百分比口径）'
      : '股息收益率（修正）：滚动1年推算分红点数D，对D做250日SMA后除以PRI'

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
    mainSma60: ISeriesApi<'Line', Time> | null
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
    mainSma60: null,
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
    if (!hover) return null
    const biasPct = biasBasis === 'sma60' ? hover.biasPct3y60 : hover.biasPct3y250
    return calcLowVolSuggestion({
      spreadPctRank10y: hover.spreadPctRank10y,
      biasPct3y: biasPct,
      thresh,
    })
  }, [biasBasis, hover, thresh])

  const updateSpreadPctZones = useCallback(() => {
    if (!showSpreadPctPane) return
    const chart = chartsRef.current.spreadPct
    const cheapBg = spreadPctCheapBgRef.current
    const expBg = spreadPctExpBgRef.current
    const metric = seriesRef.current.spreadPct as unknown as { priceToCoordinate?: (price: number) => number | null } | null
    if (!chart || !cheapBg || !expBg || !metric?.priceToCoordinate) return

    const y100 = metric.priceToCoordinate(100)
    const y80 = metric.priceToCoordinate(thresh.spreadCheapPctRank10y)
    const y20 = metric.priceToCoordinate(thresh.spreadExpensivePctRank10y)
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
  }, [showSpreadPctPane, thresh])
  const updateSpreadPctZonesRef = useRef<() => void>(() => {})
  useEffect(() => {
    updateSpreadPctZonesRef.current = updateSpreadPctZones
  }, [updateSpreadPctZones])

  const data = useMemo(() => {
    const close: LineData<Time>[] = []
    const sma60: LineData<Time>[] = []
    const ma: LineData<Time>[] = []
    const bias60: LineData<Time>[] = []
    const bias250: LineData<Time>[] = []
    const biasPct3y60: LineData<Time>[] = []
    const biasPct3y250: LineData<Time>[] = []
    const spreadSmooth: LineData<Time>[] = []
    const spreadPctRank10y: LineData<Time>[] = []
    const segBase: Array<{ time: UTCTimestamp; close: number; spreadPctRank10y?: number; biasPct3y?: number }> = []
    const allocStrongSegments: Array<LineData<Time>[]> = []
    const reduceStrongSegments: Array<LineData<Time>[]> = []
    const allocWeakSegments: Array<LineData<Time>[]> = []
    const neutralSegments: Array<LineData<Time>[]> = []
    const map = new Map<UTCTimestamp, HoverState>()

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      if (typeof p.close === 'number' && Number.isFinite(p.close)) {
        close.push({ time: t, value: p.close })
        const bp =
          biasBasis === 'sma60'
            ? typeof p.biasPct3y60 === 'number' && Number.isFinite(p.biasPct3y60)
              ? p.biasPct3y60
              : undefined
            : typeof p.biasPct3y === 'number' && Number.isFinite(p.biasPct3y)
              ? p.biasPct3y
              : undefined
        segBase.push({
          time: t,
          close: p.close,
          spreadPctRank10y: typeof p.spreadPctRank10y === 'number' && Number.isFinite(p.spreadPctRank10y) ? p.spreadPctRank10y : undefined,
          biasPct3y: bp,
        })
      }
      if (typeof p.ma60 === 'number' && Number.isFinite(p.ma60)) sma60.push({ time: t, value: p.ma60 })
      if (typeof p.ma250 === 'number' && Number.isFinite(p.ma250)) ma.push({ time: t, value: p.ma250 })
      if (typeof p.bias60 === 'number' && Number.isFinite(p.bias60)) bias60.push({ time: t, value: p.bias60 })
      if (typeof p.bias250 === 'number' && Number.isFinite(p.bias250)) bias250.push({ time: t, value: p.bias250 })
      if (typeof p.biasPct3y60 === 'number' && Number.isFinite(p.biasPct3y60)) biasPct3y60.push({ time: t, value: p.biasPct3y60 })
      if (typeof p.biasPct3y === 'number' && Number.isFinite(p.biasPct3y)) biasPct3y250.push({ time: t, value: p.biasPct3y })
      if (typeof p.spreadSmoothPct === 'number' && Number.isFinite(p.spreadSmoothPct)) spreadSmooth.push({ time: t, value: p.spreadSmoothPct })
      if (typeof p.spreadPctRank10y === 'number' && Number.isFinite(p.spreadPctRank10y))
        spreadPctRank10y.push({ time: t, value: p.spreadPctRank10y })

      map.set(t, {
        t,
        date: p.date,
        close: typeof p.close === 'number' && Number.isFinite(p.close) ? p.close : undefined,
        sma60: typeof p.ma60 === 'number' && Number.isFinite(p.ma60) ? p.ma60 : undefined,
        ma250: typeof p.ma250 === 'number' && Number.isFinite(p.ma250) ? p.ma250 : undefined,
        bias60: typeof p.bias60 === 'number' && Number.isFinite(p.bias60) ? p.bias60 : undefined,
        bias250: typeof p.bias250 === 'number' && Number.isFinite(p.bias250) ? p.bias250 : undefined,
        biasPct3y60: typeof p.biasPct3y60 === 'number' && Number.isFinite(p.biasPct3y60) ? p.biasPct3y60 : undefined,
        biasPct3y250: typeof p.biasPct3y === 'number' && Number.isFinite(p.biasPct3y) ? p.biasPct3y : undefined,
        spreadSmooth: typeof p.spreadSmoothPct === 'number' && Number.isFinite(p.spreadSmoothPct) ? p.spreadSmoothPct : undefined,
        spreadPctRank10y:
          typeof p.spreadPctRank10y === 'number' && Number.isFinite(p.spreadPctRank10y) ? p.spreadPctRank10y : undefined,
      })
    }

    close.sort((a, b) => (a.time as number) - (b.time as number))
    sma60.sort((a, b) => (a.time as number) - (b.time as number))
    ma.sort((a, b) => (a.time as number) - (b.time as number))
    bias60.sort((a, b) => (a.time as number) - (b.time as number))
    bias250.sort((a, b) => (a.time as number) - (b.time as number))
    biasPct3y60.sort((a, b) => (a.time as number) - (b.time as number))
    biasPct3y250.sort((a, b) => (a.time as number) - (b.time as number))
    spreadSmooth.sort((a, b) => (a.time as number) - (b.time as number))
    spreadPctRank10y.sort((a, b) => (a.time as number) - (b.time as number))

    segBase.sort((a, b) => a.time - b.time)

    type SegState = 'allocStrong' | 'reduceStrong' | 'allocWeak' | 'neutral' | null
    const classify = (p: { spreadPctRank10y?: number; biasPct3y?: number }): SegState => {
      const spread = p.spreadPctRank10y
      if (typeof spread !== 'number' || !Number.isFinite(spread)) return null
      const bias = p.biasPct3y
      const cheap = spread >= thresh.spreadCheapPctRank10y
      const lowBias = typeof bias === 'number' && Number.isFinite(bias) ? bias <= thresh.biasLowPct3y : false
      const highBias = typeof bias === 'number' && Number.isFinite(bias) ? bias >= thresh.biasHighPct3y : false
      if (highBias) return 'reduceStrong'
      if (cheap && lowBias) return 'allocStrong'
      if (cheap) return 'allocWeak'
      return 'neutral'
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
      else if (bufState === 'neutral') neutralSegments.push(buf)
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

    return {
      close,
      sma60,
      ma,
      bias60,
      bias250,
      biasPct3y60,
      biasPct3y250,
      spreadSmooth,
      spreadPctRank10y,
      allocStrongSegments,
      reduceStrongSegments,
      allocWeakSegments,
      neutralSegments,
      map,
    }
  }, [biasBasis, series, thresh])

  useEffect(() => {
    const el = mainElRef.current
    if (!el || chartsRef.current.main) return
    const charts = chartsRef.current
    const seriesStore = seriesRef.current

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

    const sma60Series = chart.addSeries(LineSeries, {
      color: 'rgba(147,197,253,0.95)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const maSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.65)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    charts.main = chart
    seriesStore.mainClose = closeSeries
    seriesStore.mainSma60 = sma60Series
    seriesStore.mainMa = maSeries

    return () => {
      chart.remove()
      if (charts.main === chart) charts.main = null
      seriesStore.mainClose = null
      seriesStore.mainSma60 = null
      seriesStore.mainMa = null
    }
  }, [])

  useEffect(() => {
    const el = biasElRef.current
    if (!el || chartsRef.current.bias) return
    const charts = chartsRef.current
    const seriesStore = seriesRef.current

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

    charts.bias = chart
    seriesStore.bias = metric
    seriesStore.biasAlign = align

    return () => {
      chart.remove()
      if (charts.bias === chart) charts.bias = null
      seriesStore.bias = null
      seriesStore.biasAlign = null
    }
  }, [])

  useEffect(() => {
    const el = biasPctElRef.current
    if (!el || chartsRef.current.biasPct) return
    const charts = chartsRef.current
    const seriesStore = seriesRef.current

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

    charts.biasPct = chart
    seriesStore.biasPct = metric
    seriesStore.biasPctAlign = align

    return () => {
      chart.remove()
      if (charts.biasPct === chart) charts.biasPct = null
      seriesStore.biasPct = null
      seriesStore.biasPctAlign = null
    }
  }, [])

  useEffect(() => {
    const el = spreadElRef.current
    if (!el || chartsRef.current.spread) return
    const charts = chartsRef.current
    const seriesStore = seriesRef.current

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

    charts.spread = chart
    seriesStore.spread = metric
    seriesStore.spreadAlign = align

    return () => {
      chart.remove()
      if (charts.spread === chart) charts.spread = null
      seriesStore.spread = null
      seriesStore.spreadAlign = null
    }
  }, [])

  useEffect(() => {
    const el = spreadPctElRef.current
    if (!el || chartsRef.current.spreadPct) return
    const charts = chartsRef.current
    const seriesStore = seriesRef.current

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

    charts.spreadPct = chart
    seriesStore.spreadPct = metric
    seriesStore.spreadPctAlign = align
    const onRange = () => requestAnimationFrame(() => updateSpreadPctZonesRef.current())
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      chart.remove()
      if (charts.spreadPct === chart) charts.spreadPct = null
      seriesStore.spreadPct = null
      seriesStore.spreadPctAlign = null
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

    const onVisibleLogicalRange = (src: IChartApi) => (range: LogicalRange | null) => {
      if (syncingRef.current) return
      if (!hasValidLogicalRange(range)) return
      syncingRef.current = true
      try {
        for (const c of charts) {
          if (c === src) continue
          safeSetVisibleLogicalRange(c, range)
        }
      } finally {
        syncingRef.current = false
      }
    }

    const onCrosshair = (src: IChartApi) => (param: { time?: Time } | null) => {
      if (syncingRef.current) return
      const t = normalizeTime(param?.time)
      if (!t) {
        setHover(null)
        syncingRef.current = true
        try {
          for (const c of charts) {
            if (c === src) continue
            safeClearCrosshair(c)
          }
        } finally {
          syncingRef.current = false
        }
        return
      }

      const h = data.map.get(t) ?? null
      setHover(h)

      const mainClose = seriesRef.current.mainClose
      const biasSeries = seriesRef.current.bias
      const biasPctSeries = seriesRef.current.biasPct
      const spreadSeries = seriesRef.current.spread
      const spreadPctSeries = seriesRef.current.spreadPct
      const hvBias = biasBasis === 'sma60' ? h?.bias60 : h?.bias250
      const hvBiasPct = biasBasis === 'sma60' ? h?.biasPct3y60 : h?.biasPct3y250

      syncingRef.current = true
      try {
        for (const c of charts) {
          if (c === src) continue
          const synced =
            (c === main && safeSetCrosshair(c, h?.close, t, mainClose)) ||
            (c === bias && safeSetCrosshair(c, isFiniteNumber(hvBias) ? hvBias : undefined, t, biasSeries)) ||
            (c === biasPct && safeSetCrosshair(c, isFiniteNumber(hvBiasPct) ? hvBiasPct : undefined, t, biasPctSeries)) ||
            (c === spread && safeSetCrosshair(c, h?.spreadSmooth, t, spreadSeries)) ||
            (c === spreadPct && safeSetCrosshair(c, h?.spreadPctRank10y, t, spreadPctSeries))
          if (!synced) safeClearCrosshair(c)
        }
      } finally {
        syncingRef.current = false
      }
    }

    const rangeHandlers = charts.map((c) => ({ chart: c, fn: onVisibleLogicalRange(c) }))
    for (const { chart, fn } of rangeHandlers) chart.timeScale().subscribeVisibleLogicalRangeChange(fn)

    const crossHandlers = charts.map((c) => ({ chart: c, fn: onCrosshair(c) }))
    for (const { chart, fn } of crossHandlers) chart.subscribeCrosshairMove(fn)

    return () => {
      for (const { chart, fn } of rangeHandlers) chart.timeScale().unsubscribeVisibleLogicalRangeChange(fn)
      for (const { chart, fn } of crossHandlers) chart.unsubscribeCrosshairMove(fn)
    }
  }, [biasBasis, data.map, showBiasPane, showBiasPctPane, showSpreadPane, showSpreadPctPane])

  useEffect(() => {
    seriesRef.current.mainClose?.setData(data.close)
    seriesRef.current.mainSma60?.setData(showSma60 ? data.sma60 : [])
    seriesRef.current.mainMa?.setData(showMa250 ? data.ma : [])
    seriesRef.current.bias?.setData(showBiasPane ? (biasBasis === 'sma60' ? data.bias60 : data.bias250) : [])
    seriesRef.current.biasAlign?.setData(data.close)
    seriesRef.current.biasPct?.setData(
      showBiasPctPane ? (biasBasis === 'sma60' ? data.biasPct3y60 : data.biasPct3y250) : [],
    )
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
    if (!main) return

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
    for (const seg of data.neutralSegments) addSeg(seg, '#60A5FA')

    const visiblePanes: Array<'bias' | 'biasPct' | 'spread' | 'spreadPct'> = []
    if (showBiasPane) visiblePanes.push('bias')
    if (showBiasPctPane) visiblePanes.push('biasPct')
    if (showSpreadPane) visiblePanes.push('spread')
    if (showSpreadPctPane) visiblePanes.push('spreadPct')
    const lastPane = visiblePanes.length ? visiblePanes[visiblePanes.length - 1] : null
    safeSetTimeScaleVisible(main, lastPane == null)
    safeSetTimeScaleVisible(bias, lastPane === 'bias')
    safeSetTimeScaleVisible(biasPct, lastPane === 'biasPct')
    safeSetTimeScaleVisible(spread, lastPane === 'spread')
    safeSetTimeScaleVisible(spreadPct, lastPane === 'spreadPct')

    const key = data.close.length ? `${data.close.length}:${String(data.close[data.close.length - 1]?.time ?? '')}` : ''
    if (key && initViewKeyRef.current !== key) {
      initViewKeyRef.current = key
      const total = data.close.length
      const to = Math.max(0, total - 1)
      const from = total > 720 ? total - 720 : 0
      safeSetVisibleLogicalRange(main, { from, to } as LogicalRange)
    }

    const range = main.timeScale().getVisibleLogicalRange()
    if (hasValidLogicalRange(range)) {
      if (showBiasPane) safeSetVisibleLogicalRange(bias, range)
      if (showBiasPctPane) safeSetVisibleLogicalRange(biasPct, range)
      if (showSpreadPane) safeSetVisibleLogicalRange(spread, range)
      if (showSpreadPctPane) safeSetVisibleLogicalRange(spreadPct, range)
    }
    requestAnimationFrame(updateSpreadPctZones)
  }, [biasBasis, data, showBiasPane, showBiasPctPane, showMa250, showSma60, showSpreadPane, showSpreadPctPane, updateSpreadPctZones])

  useEffect(() => {
    const main = chartsRef.current.main
    if (!main) return
    const allCharts = [
      chartsRef.current.main,
      chartsRef.current.bias,
      chartsRef.current.biasPct,
      chartsRef.current.spread,
      chartsRef.current.spreadPct,
    ]
    syncingRef.current = true
    try {
      for (const chart of allCharts) safeClearCrosshair(chart)
    } finally {
      syncingRef.current = false
    }
    const range = main.timeScale().getVisibleLogicalRange()
    if (!hasValidLogicalRange(range)) return
    if (showBiasPane) safeSetVisibleLogicalRange(chartsRef.current.bias, range)
    if (showBiasPctPane) safeSetVisibleLogicalRange(chartsRef.current.biasPct, range)
    if (showSpreadPane) safeSetVisibleLogicalRange(chartsRef.current.spread, range)
    if (showSpreadPctPane) safeSetVisibleLogicalRange(chartsRef.current.spreadPct, range)
    requestAnimationFrame(updateSpreadPctZones)
  }, [showBiasPane, showBiasPctPane, showSpreadPane, showSpreadPctPane, updateSpreadPctZones])

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
  }, [showSpreadPctPane, updateSpreadPctZones])

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
          onClick={() => setShowSma60((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showSma60 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#93C5FD]" />
          SMA60
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
          SMA250
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
              <span className="mr-2 rounded bg-white/10 px-2 py-[2px] font-mono text-[11px] text-[#E6EDF7]">—</span>
              数据缺失：利差分位(5年) 缺失/非数字
            </div>
            <div>
              <span className="mr-2 rounded bg-[rgba(16,185,129,0.18)] px-2 py-[2px] font-mono text-[11px] text-[#34D399]">偏加仓</span>
              利差分位(5年) ≥ {thresh.spreadCheapPctRank10y} 且 BIAS分位(5年) ≤ {thresh.biasLowPct3y}
            </div>
            <div>
              <span className="mr-2 rounded bg-[rgba(239,68,68,0.18)] px-2 py-[2px] font-mono text-[11px] text-[#F87171]">偏减仓</span>
              BIAS分位(5年) ≥ {thresh.biasHighPct3y}
            </div>
            <div>
              <span className="mr-2 rounded bg-[rgba(245,158,11,0.18)] px-2 py-[2px] font-mono text-[11px] text-[#FBBF24]">偏持有</span>
              利差分位(5年) ≥ {thresh.spreadCheapPctRank10y} 且 未触发偏加仓 且 未触发偏减仓
            </div>
            <div>
              <span className="mr-2 rounded bg-[rgba(96,165,250,0.18)] px-2 py-[2px] font-mono text-[11px] text-[#60A5FA]">偏观望</span>
              除以上其他情况
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="text-[#E6EDF7]">指标定义</div>
            {isValueTiming && indexDesc ? (
              <div>
                指数介绍：{indexLabel ? `${indexLabel}（${indexCode ?? ''}）` : indexCode ? `指数（${indexCode}）` : '指数'}，{indexDesc}
              </div>
            ) : null}
            {isValue100 ? <div>动态PE来源：历史数据来自 touzid（截至2026/4/13），增量数据来自国证指数官网每日抓取。</div> : null}
            <div>{metricDefinition}</div>
            <div>利差（核心）：{spreadCoreLabel}</div>
            <div>利差分位：核心利差的5年滚动分位（window≈1260，minPeriods=252）</div>
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
                          : signal.tone === 'warn'
                            ? 'bg-[rgba(245,158,11,0.18)] text-[#FBBF24]'
                            : signal.tone === 'neutral'
                              ? 'bg-[rgba(96,165,250,0.18)] text-[#60A5FA]'
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
            {showSma60 ? (
              <>
                <div className="text-[#A9B6CC]">SMA60</div>
                <div className="text-right font-mono">{fmt(hover.sma60, 2)}</div>
              </>
            ) : null}
            {showMa250 ? (
              <>
                <div className="text-[#A9B6CC]">SMA250</div>
                <div className="text-right font-mono">{fmt(hover.ma250, 2)}</div>
              </>
            ) : null}
            {showBiasPane ? (
              <>
                <div className="text-[#A9B6CC]">BIAS({biasBasis === 'sma60' ? '60' : '250'})</div>
                <div className="text-right font-mono">{fmt(biasBasis === 'sma60' ? hover.bias60 : hover.bias250, 4)}</div>
              </>
            ) : null}
            {showBiasPctPane ? (
              <>
                <div className="text-[#A9B6CC]">BIAS分位(5年, {biasBasis === 'sma60' ? 'SMA60' : 'SMA250'})</div>
                <div className="text-right font-mono">{fmt(biasBasis === 'sma60' ? hover.biasPct3y60 : hover.biasPct3y250, 1)}</div>
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
                <div className="text-[#A9B6CC]">利差分位(5年)</div>
                <div className="text-right font-mono">{fmt(hover.spreadPctRank10y, 1)}</div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="relative rounded-lg border border-white/10 bg-[#111B2E] pt-6">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            指数（主图）{showSma60 ? ' + SMA60' : ''}{showMa250 ? ' + SMA250' : ''}
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
            BIAS({biasBasis === 'sma60' ? '60' : '250'})
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
            BIAS分位(5年, {biasBasis === 'sma60' ? 'SMA60' : 'SMA250'})
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
            利差分位(5年)
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
