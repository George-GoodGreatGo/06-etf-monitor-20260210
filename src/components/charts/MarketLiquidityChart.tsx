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
  v5Pct?: number
  ebPct?: number
  bbMid?: number
  bbUpper?: number
  bbLower?: number
  bbBandwidth?: number
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

type NullableLinePoint = { time: Time; value: number | null }

function buildBollingerBands(points: LineData<Time>[], period = 120, k = 2.0): {
  mid: NullableLinePoint[]
  upper: NullableLinePoint[]
  lower: NullableLinePoint[]
  bandwidth: NullableLinePoint[]
} {
  const mid: NullableLinePoint[] = []
  const upper: NullableLinePoint[] = []
  const lower: NullableLinePoint[] = []
  const bandwidth: NullableLinePoint[] = []

  if (!points.length) return { mid, upper, lower, bandwidth }

  const window: number[] = []
  let sum = 0
  let sumSq = 0

  for (const p of points) {
    const v = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null

    if (v == null) {
      // 中文说明：若 close 无效，则本日无法计算布林带；同时清空窗口，避免在包含缺失值的窗口上计算。
      window.length = 0
      sum = 0
      sumSq = 0
      mid.push({ time: p.time, value: null })
      upper.push({ time: p.time, value: null })
      lower.push({ time: p.time, value: null })
      bandwidth.push({ time: p.time, value: null })
      continue
    }

    window.push(v)
    sum += v
    sumSq += v * v

    if (window.length > period) {
      const removed = window.shift()
      if (typeof removed === 'number') {
        sum -= removed
        sumSq -= removed * removed
      }
    }

    if (window.length < period) {
      // 中文说明：数据不足 period 天时，按要求填充缺失值，保证输出长度与输入一致。
      mid.push({ time: p.time, value: null })
      upper.push({ time: p.time, value: null })
      lower.push({ time: p.time, value: null })
      bandwidth.push({ time: p.time, value: null })
      continue
    }

    // 中文说明：中轨 = 过去 N 天收盘价的简单移动平均（SMA）
    const mb = sum / period

    // 中文说明：样本标准差（n-1）。使用 sumSq 与 sum 的推导式以提升性能：Var = (Σx^2 - (Σx)^2/n) / (n-1)
    const numerator = sumSq - (sum * sum) / period
    const variance = numerator <= 0 ? 0 : numerator / (period - 1)
    const std = Math.sqrt(variance)

    // 中文说明：上轨/下轨 = 中轨 ± K * 标准差
    const ub = mb + k * std
    const lb = mb - k * std

    // 中文说明：带宽 = (上轨 - 下轨) / 中轨；若中轨为 0，则按缺失值处理避免除零。
    const bw = mb === 0 ? null : (ub - lb) / mb

    mid.push({ time: p.time, value: mb })
    upper.push({ time: p.time, value: ub })
    lower.push({ time: p.time, value: lb })
    bandwidth.push({ time: p.time, value: bw })
  }

  return { mid, upper, lower, bandwidth }
}

export default function MarketLiquidityChart({ series, equityBond, className }: Props) {
  const priceElRef = useRef<HTMLDivElement | null>(null)
  const v5ElRef = useRef<HTMLDivElement | null>(null)
  const v5PctElRef = useRef<HTMLDivElement | null>(null)
  const ebElRef = useRef<HTMLDivElement | null>(null)
  const v5OverboughtBgRef = useRef<HTMLDivElement | null>(null)
  const v5OversoldBgRef = useRef<HTMLDivElement | null>(null)
  const v5PctOverboughtBgRef = useRef<HTMLDivElement | null>(null)
  const v5PctOversoldBgRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)
  const initViewKeyRef = useRef<string>('')

  const chartsRef = useRef<{ price: IChartApi | null; v5: IChartApi | null; v5Pct: IChartApi | null; eb: IChartApi | null }>({
    price: null,
    v5: null,
    v5Pct: null,
    eb: null,
  })
  const seriesRef = useRef<{
    hs300: ISeriesApi<'Line', Time> | null
    ema20: ISeriesApi<'Line', Time> | null
    ema60: ISeriesApi<'Line', Time> | null
    bbMid: ISeriesApi<'Line', Time> | null
    bbUpper: ISeriesApi<'Line', Time> | null
    bbLower: ISeriesApi<'Line', Time> | null
    v5: ISeriesApi<'Line', Time> | null
    v5Align: ISeriesApi<'Line', Time> | null
    v5Pct: ISeriesApi<'Line', Time> | null
    v5PctAlign: ISeriesApi<'Line', Time> | null
    eb: ISeriesApi<'Line', Time> | null
    ebAlign: ISeriesApi<'Line', Time> | null
  }>({
    hs300: null,
    ema20: null,
    ema60: null,
    bbMid: null,
    bbUpper: null,
    bbLower: null,
    v5: null,
    v5Align: null,
    v5Pct: null,
    v5PctAlign: null,
    eb: null,
    ebAlign: null,
  })
  const hsSegRef = useRef<{ hot: ISeriesApi<'Line', Time>[]; cold: ISeriesApi<'Line', Time>[] }>({
    hot: [],
    cold: [],
  })
  const [hover, setHover] = useState<HoverState | null>(null)
  const [showEma20, setShowEma20] = useState(true)
  const [showEma60, setShowEma60] = useState(true)
  const [showBoll, setShowBoll] = useState(true)
  const [showLiquidityPane, setShowLiquidityPane] = useState(true)
  const [showLiquidityPctPane, setShowLiquidityPctPane] = useState(true)
  const [showEquityBondPane, setShowEquityBondPane] = useState(true)

  const updateV5ZoneBg = () => {
    if (!showLiquidityPane) return
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

  const updateV5PctZoneBg = () => {
    if (!showLiquidityPctPane) return
    const el = v5PctElRef.current
    const overEl = v5PctOverboughtBgRef.current
    const underEl = v5PctOversoldBgRef.current
    const s = seriesRef.current.v5Pct
    if (!el || !overEl || !underEl || !s) return

    const h = el.clientHeight
    const y80 = s.priceToCoordinate(80)
    const y20 = s.priceToCoordinate(20)
    if (y80 == null || y20 == null) {
      overEl.style.display = 'none'
      underEl.style.display = 'none'
      return
    }
    overEl.style.display = 'block'
    underEl.style.display = 'block'

    const topY = Math.max(0, Math.min(h, y80))
    const bottomY = Math.max(0, Math.min(h, y20))

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
    const v5Pct: LineData<Time>[] = []
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
      if (typeof p.v5Pct === 'number' && Number.isFinite(p.v5Pct)) {
        v5Pct.push({ time: t, value: p.v5Pct })
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
        v5Pct: typeof p.v5Pct === 'number' && Number.isFinite(p.v5Pct) ? p.v5Pct : undefined,
        ebPct: typeof ebPct === 'number' && Number.isFinite(ebPct) ? ebPct : undefined,
      })
    }

    if (hotBuf.length) hsHotSegments.push(hotBuf)
    if (coldBuf.length) hsColdSegments.push(coldBuf)

    const ema20 = buildEma(hs, 20)
    const ema60 = buildEma(hs, 60)

    const bbRaw = buildBollingerBands(hs, 120, 2.0)
    const bbMid = bbRaw.mid.filter((p): p is { time: Time; value: number } => typeof p.value === 'number' && Number.isFinite(p.value))
    const bbUpper = bbRaw.upper.filter((p): p is { time: Time; value: number } => typeof p.value === 'number' && Number.isFinite(p.value))
    const bbLower = bbRaw.lower.filter((p): p is { time: Time; value: number } => typeof p.value === 'number' && Number.isFinite(p.value))

    for (let i = 0; i < hs.length; i++) {
      const t = hs[i]?.time
      if (typeof t !== 'number') continue
      const h = map.get(t as UTCTimestamp)
      if (!h) continue
      const mb = bbRaw.mid[i]?.value ?? null
      const ub = bbRaw.upper[i]?.value ?? null
      const lb = bbRaw.lower[i]?.value ?? null
      const bw = bbRaw.bandwidth[i]?.value ?? null
      h.bbMid = typeof mb === 'number' && Number.isFinite(mb) ? mb : undefined
      h.bbUpper = typeof ub === 'number' && Number.isFinite(ub) ? ub : undefined
      h.bbLower = typeof lb === 'number' && Number.isFinite(lb) ? lb : undefined
      h.bbBandwidth = typeof bw === 'number' && Number.isFinite(bw) ? bw : undefined
    }

    const hasSampleInsufficient = series.length > 0 && v5Pct.length < 378
    return { hs, hsHotSegments, hsColdSegments, ema20, ema60, bbMid, bbUpper, bbLower, v5, v5Pct, eb, map, hasSampleInsufficient }
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

    const bbMid = chart.addSeries(LineSeries, {
      color: 'rgba(226,232,240,0.60)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    const bbUpper = chart.addSeries(LineSeries, {
      color: 'rgba(148,163,184,0.60)',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    const bbLower = chart.addSeries(LineSeries, {
      color: 'rgba(148,163,184,0.60)',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => fmt(v, 2) },
    })

    chartsRef.current.price = chart
    seriesRef.current.hs300 = hs
    seriesRef.current.ema20 = ema20
    seriesRef.current.ema60 = ema60
    seriesRef.current.bbMid = bbMid
    seriesRef.current.bbUpper = bbUpper
    seriesRef.current.bbLower = bbLower

    return () => {
      chart.remove()
      if (chartsRef.current.price === chart) chartsRef.current.price = null
      seriesRef.current.hs300 = null
      seriesRef.current.ema20 = null
      seriesRef.current.ema60 = null
      seriesRef.current.bbMid = null
      seriesRef.current.bbUpper = null
      seriesRef.current.bbLower = null
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
    seriesRef.current.bbMid?.applyOptions({ visible: showBoll })
    seriesRef.current.bbUpper?.applyOptions({ visible: showBoll })
    seriesRef.current.bbLower?.applyOptions({ visible: showBoll })
  }, [showBoll])

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
    if (!v5PctElRef.current || chartsRef.current.v5Pct) return

    const chart = createChart(v5PctElRef.current, {
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

    const v5Pct = chart.addSeries(LineSeries, {
      color: '#22D3EE',
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

    v5Pct.createPriceLine({
      price: 20,
      color: 'rgba(16,185,129,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })
    v5Pct.createPriceLine({
      price: 80,
      color: 'rgba(239,68,68,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    })

    chartsRef.current.v5Pct = chart
    seriesRef.current.v5Pct = v5Pct
    seriesRef.current.v5PctAlign = align

    return () => {
      chart.remove()
      if (chartsRef.current.v5Pct === chart) chartsRef.current.v5Pct = null
      seriesRef.current.v5Pct = null
      seriesRef.current.v5PctAlign = null
    }
  }, [])

  useEffect(() => {
    const price = chartsRef.current.price
    const v5 = chartsRef.current.v5
    const v5Pct = chartsRef.current.v5Pct
    const eb = chartsRef.current.eb
    if (!price) return

    const charts: IChartApi[] = [price]
    if (showLiquidityPane && v5) charts.push(v5)
    if (showLiquidityPctPane && v5Pct) charts.push(v5Pct)
    if (showEquityBondPane && eb) charts.push(eb)
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
      requestAnimationFrame(updateV5ZoneBg)
      requestAnimationFrame(updateV5PctZoneBg)
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
        requestAnimationFrame(updateV5PctZoneBg)
        return
      }

      setHover(data.map.get(t) ?? null)

      const hsSeries = seriesRef.current.hs300
      const v5Series = seriesRef.current.v5
      const v5PctSeries = seriesRef.current.v5Pct
      const ebSeries = seriesRef.current.eb
      const h = data.map.get(t)

      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        if (c === price && hsSeries && typeof h?.close === 'number') {
          c.setCrosshairPosition(h.close, t, hsSeries)
        } else if (c === v5 && v5Series && typeof h?.v5 === 'number') {
          c.setCrosshairPosition(h.v5, t, v5Series)
        } else if (c === v5Pct && v5PctSeries && typeof h?.v5Pct === 'number') {
          c.setCrosshairPosition(h.v5Pct, t, v5PctSeries)
        } else if (c === eb && ebSeries && typeof h?.ebPct === 'number') {
          c.setCrosshairPosition(h.ebPct, t, ebSeries)
        } else {
          c.clearCrosshairPosition()
        }
      }
      syncingRef.current = false
      requestAnimationFrame(updateV5ZoneBg)
      requestAnimationFrame(updateV5PctZoneBg)
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
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            requestAnimationFrame(updateV5ZoneBg)
            requestAnimationFrame(updateV5PctZoneBg)
          })
    if (ro && v5ElRef.current && showLiquidityPane) ro.observe(v5ElRef.current)
    if (ro && v5PctElRef.current && showLiquidityPctPane) ro.observe(v5PctElRef.current)

    return () => {
      for (const { chart, fn } of rangeHandlers) {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(fn)
      }
      for (const { chart, fn } of crossHandlers) {
        chart.unsubscribeCrosshairMove(fn)
      }
      ro?.disconnect()
    }
  }, [data.map, showEquityBondPane, showLiquidityPane, showLiquidityPctPane])

  useEffect(() => {
    seriesRef.current.hs300?.setData(data.hs)
    seriesRef.current.ema20?.setData(data.ema20)
    seriesRef.current.ema60?.setData(data.ema60)
    seriesRef.current.bbMid?.setData(data.bbMid)
    seriesRef.current.bbUpper?.setData(data.bbUpper)
    seriesRef.current.bbLower?.setData(data.bbLower)
    seriesRef.current.v5?.setData(data.v5)
    seriesRef.current.v5Align?.setData(data.hs)
    seriesRef.current.v5Pct?.setData(data.v5Pct)
    seriesRef.current.v5PctAlign?.setData(data.hs)
    seriesRef.current.eb?.setData(data.eb)
    seriesRef.current.ebAlign?.setData(data.hs)
    const price = chartsRef.current.price
    const v5 = chartsRef.current.v5
    const v5Pct = chartsRef.current.v5Pct
    const eb = chartsRef.current.eb
    if (!price) return

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

    const key = data.hs.length ? `${data.hs.length}:${String(data.hs[data.hs.length - 1]?.time ?? '')}` : ''
    if (key && initViewKeyRef.current !== key) {
      initViewKeyRef.current = key
      const total = data.hs.length
      const to = Math.max(0, total - 1)
      const from = total > 720 ? total - 720 : 0
      price.timeScale().setVisibleLogicalRange({ from, to })
    }

    const range = price.timeScale().getVisibleLogicalRange()
    if (range && showLiquidityPane && v5) v5.timeScale().setVisibleLogicalRange(range)
    if (range && showLiquidityPctPane && v5Pct) v5Pct.timeScale().setVisibleLogicalRange(range)
    if (range && showEquityBondPane && eb) eb.timeScale().setVisibleLogicalRange(range)
    requestAnimationFrame(() => {
      requestAnimationFrame(updateV5ZoneBg)
      requestAnimationFrame(updateV5PctZoneBg)
    })
  }, [data])

  useEffect(() => {
    const price = chartsRef.current.price
    if (!price) return
    const range = price.timeScale().getVisibleLogicalRange()
    if (!range) return
    if (showLiquidityPane && chartsRef.current.v5) chartsRef.current.v5.timeScale().setVisibleLogicalRange(range)
    if (showLiquidityPctPane && chartsRef.current.v5Pct) chartsRef.current.v5Pct.timeScale().setVisibleLogicalRange(range)
    if (showEquityBondPane && chartsRef.current.eb) chartsRef.current.eb.timeScale().setVisibleLogicalRange(range)
    requestAnimationFrame(updateV5ZoneBg)
    requestAnimationFrame(updateV5PctZoneBg)
  }, [showEquityBondPane, showLiquidityPane, showLiquidityPctPane])

  return (
    <div className={cn('relative', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B6CC]">
        <button
          type="button"
          onClick={() => setShowEma20((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
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
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showEma60 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
          EMA60
        </button>
        <button
          type="button"
          onClick={() => setShowBoll((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showBoll ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
          BOLL120
        </button>
        <div className="mx-2 h-4 w-px bg-white/10" />
        <button
          type="button"
          onClick={() => setShowLiquidityPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showLiquidityPane
              ? 'border-white/15 bg-white/5 text-[#E6EDF7]'
              : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          流动性
        </button>
        <button
          type="button"
          onClick={() => setShowLiquidityPctPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showLiquidityPctPane
              ? 'border-white/15 bg-white/5 text-[#E6EDF7]'
              : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          流动性分位
        </button>
        <button
          type="button"
          onClick={() => setShowEquityBondPane((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showEquityBondPane
              ? 'border-white/15 bg-white/5 text-[#E6EDF7]'
              : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          股债
        </button>
      </div>

      {hover ? (
        <div className="pointer-events-none absolute right-3 top-10 z-10 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
          <div className="font-mono text-[11px] text-[#A9B6CC]">{hover.date}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-[#A9B6CC]">沪深300</div>
            <div className="text-right font-mono">{fmt(hover.close, 2)}</div>
            {showBoll ? (
              <>
                <div className="text-[#A9B6CC]">BOLL120(MB)</div>
                <div className="text-right font-mono">{fmt(hover.bbMid, 2)}</div>
                <div className="text-[#A9B6CC]">BOLL120(UB)</div>
                <div className="text-right font-mono">{fmt(hover.bbUpper, 2)}</div>
                <div className="text-[#A9B6CC]">BOLL120(LB)</div>
                <div className="text-right font-mono">{fmt(hover.bbLower, 2)}</div>
                <div className="text-[#A9B6CC]">BOLL120(BW)</div>
                <div className="text-right font-mono">{fmt(hover.bbBandwidth, 4)}</div>
              </>
            ) : null}
            {showLiquidityPane ? (
              <>
                <div className="text-[#A9B6CC]">独家流动性指数（3指标）</div>
                <div className="text-right font-mono">{fmt(hover.v5, 1)}</div>
              </>
            ) : null}
            {showLiquidityPctPane ? (
              <>
                <div className="text-[#A9B6CC]">独家流动性指数（3年分位）</div>
                <div className="text-right font-mono">{fmt(hover.v5Pct, 1)}</div>
              </>
            ) : null}
            {showEquityBondPane ? (
              <>
                <div className="text-[#A9B6CC]">股债性价比（分位）</div>
                <div className="text-right font-mono">{fmt(hover.ebPct, 1)}</div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="relative rounded-lg border border-white/10 bg-[#111B2E] pt-6">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            沪深300（主图）{showEma20 ? '+ EMA20' : ''} {showEma60 ? '+ EMA60' : ''} {showBoll ? '+ BOLL120' : ''}
          </div>
          <div ref={priceElRef} className="h-[300px] w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showLiquidityPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showLiquidityPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            独家流动性指数（3指标）
          </div>
          <div
            ref={v5OverboughtBgRef}
            className="pointer-events-none absolute left-0 top-0 z-0 bg-[rgba(239,68,68,0.12)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div
            ref={v5OversoldBgRef}
            className="pointer-events-none absolute left-0 top-0 z-0 bg-[rgba(16,185,129,0.10)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div ref={v5ElRef} className="relative z-10 h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showEquityBondPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showEquityBondPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            股债性价比（分位）
          </div>
          <div ref={ebElRef} className="h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showLiquidityPctPane ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showLiquidityPctPane ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            独家流动性指数（3年分位）{data.hasSampleInsufficient ? ' · 样本不足' : ''}
          </div>
          <div
            ref={v5PctOverboughtBgRef}
            className="pointer-events-none absolute left-0 top-0 z-0 bg-[rgba(239,68,68,0.12)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div
            ref={v5PctOversoldBgRef}
            className="pointer-events-none absolute left-0 top-0 z-0 bg-[rgba(16,185,129,0.10)]"
            style={{ right: SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div ref={v5PctElRef} className="relative z-10 h-full w-full" />
        </div>
      </div>
    </div>
  )
}

