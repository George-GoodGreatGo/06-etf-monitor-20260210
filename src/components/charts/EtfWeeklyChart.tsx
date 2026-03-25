import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  HistogramSeries,
  LineSeries,
  createChart,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import type { EtfWeeklyChartSeries } from '@/utils/etfApi'
import { formatCompactNumber } from '@/utils/format'

const PANE_SCALE_MIN_WIDTH = 110

type Props = {
  series: EtfWeeklyChartSeries
}

type HoverState = {
  t: UTCTimestamp
  price?: number
  ema20?: number
  sma60?: number
  bbMb?: number
  bbUb?: number
  bbLb?: number
  bbBw?: number
  volume?: number
  rsi14?: number
  macd?: number
  signal?: number
  hist?: number
}

function toUnixSeconds(timeMs: number): UTCTimestamp {
  return Math.floor(timeMs / 1000) as UTCTimestamp
}

function timeToUtcYmd(t: UTCTimestamp): string {
  const d = new Date(Number(t) * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
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

function fmt(v: number | undefined, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return s.replace(/\.00$/, '')
}

function trimFixed(v: number, digits: number): string {
  if (!Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return s.replace(/\.0+$/, '').replace(/\.$/, '')
}

function alignLine(
  times: UTCTimestamp[],
  raw: LineData<Time>[],
  fallback: number,
): LineData<Time>[] {
  const map = new Map<UTCTimestamp, number>()
  for (const p of raw) map.set(p.time as UTCTimestamp, p.value)
  const out: LineData<Time>[] = []
  let last = fallback
  for (const t of times) {
    const v = map.get(t)
    if (typeof v === 'number' && Number.isFinite(v)) last = v
    out.push({ time: t, value: last })
  }
  return out
}

function alignHist(
  times: UTCTimestamp[],
  raw: HistogramData<Time>[],
  fallback: number,
): HistogramData<Time>[] {
  const map = new Map<UTCTimestamp, HistogramData<Time>>()
  for (const p of raw) map.set(p.time as UTCTimestamp, p)
  const out: HistogramData<Time>[] = []
  let last = fallback
  for (const t of times) {
    const hit = map.get(t)
    if (hit && typeof hit.value === 'number' && Number.isFinite(hit.value)) {
      last = hit.value
      out.push(hit)
    } else {
      out.push({ time: t, value: last, color: 'rgba(255,255,255,0.0)' })
    }
  }
  return out
}

export default function EtfWeeklyChart({ series }: Props) {
  const [showEma20, setShowEma20] = useState(true)
  const [showSma60, setShowSma60] = useState(true)
  const [showBB, setShowBB] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [showRsi, setShowRsi] = useState(true)
  const [showMacd, setShowMacd] = useState(true)

  const [hover, setHover] = useState<HoverState | null>(null)

  const priceElRef = useRef<HTMLDivElement | null>(null)
  const volElRef = useRef<HTMLDivElement | null>(null)
  const rsiElRef = useRef<HTMLDivElement | null>(null)
  const macdElRef = useRef<HTMLDivElement | null>(null)
  const rsiOverboughtBgRef = useRef<HTMLDivElement | null>(null)
  const rsiOversoldBgRef = useRef<HTMLDivElement | null>(null)

  const syncingRef = useRef(false)

  const updateRsiZoneBg = () => {
    const el = rsiElRef.current
    const overEl = rsiOverboughtBgRef.current
    const underEl = rsiOversoldBgRef.current
    const s = seriesRef.current.rsi14
    if (!el || !overEl || !underEl || !s) return

    const h = el.clientHeight
    const y70 = s.priceToCoordinate(70)
    const y30 = s.priceToCoordinate(30)
    if (y70 == null || y30 == null) return

    const topY = Math.max(0, Math.min(h, y70))
    const bottomY = Math.max(0, Math.min(h, y30))

    overEl.style.top = '0px'
    overEl.style.height = `${topY}px`

    underEl.style.top = `${bottomY}px`
    underEl.style.height = `${Math.max(0, h - bottomY)}px`
  }

  const chartsRef = useRef<{
    price: IChartApi | null
    volume: IChartApi | null
    rsi: IChartApi | null
    macd: IChartApi | null
  }>({ price: null, volume: null, rsi: null, macd: null })

  const seriesRef = useRef<{
    price: ISeriesApi<'Line', Time> | null
    ema20: ISeriesApi<'Line', Time> | null
    sma60: ISeriesApi<'Line', Time> | null
    mb: ISeriesApi<'Line', Time> | null
    ub: ISeriesApi<'Line', Time> | null
    lb: ISeriesApi<'Line', Time> | null
    volume: ISeriesApi<'Histogram', Time> | null
    rsi14: ISeriesApi<'Line', Time> | null
    macd: ISeriesApi<'Line', Time> | null
    signal: ISeriesApi<'Line', Time> | null
    hist: ISeriesApi<'Histogram', Time> | null
  }>({
    price: null,
    ema20: null,
    sma60: null,
    mb: null,
    ub: null,
    lb: null,
    volume: null,
    rsi14: null,
    macd: null,
    signal: null,
    hist: null,
  })

  const data = useMemo(() => {
    const priceRaw: LineData<Time>[] = series.price.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const ema20Raw: LineData<Time>[] = series.ema20.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const sma60Raw: LineData<Time>[] = series.sma60.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const bbMbRaw: LineData<Time>[] = series.bb.mb.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const bbUbRaw: LineData<Time>[] = series.bb.ub.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const bbLbRaw: LineData<Time>[] = series.bb.lb.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const bbBwRaw: LineData<Time>[] = series.bb.bandwidth.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const volumeRaw: HistogramData<Time>[] = series.volume.map((p) => ({
      time: toUnixSeconds(p.time),
      value: p.value,
      ...(p.color ? { color: p.color } : {}),
    }))
    const rsi14Raw: LineData<Time>[] = series.rsi14.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const macdLineRaw: LineData<Time>[] = series.macd.macd.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const signalLineRaw: LineData<Time>[] = series.macd.signal.map((p) => ({ time: toUnixSeconds(p.time), value: p.value }))
    const histRaw: HistogramData<Time>[] = series.macd.hist.map((p) => ({
      time: toUnixSeconds(p.time),
      value: p.value,
      ...(p.color ? { color: p.color } : {}),
    }))

    const times = priceRaw.map((p) => p.time as UTCTimestamp)
    const price = priceRaw
    const ema20 = alignLine(times, ema20Raw, priceRaw[0]?.value ?? 0)
    const sma60 = alignLine(times, sma60Raw, priceRaw[0]?.value ?? 0)
    const bbMb = alignLine(times, bbMbRaw, priceRaw[0]?.value ?? 0)
    const bbUb = alignLine(times, bbUbRaw, priceRaw[0]?.value ?? 0)
    const bbLb = alignLine(times, bbLbRaw, priceRaw[0]?.value ?? 0)
    const bbBw = alignLine(times, bbBwRaw, 0)
    const volume = alignHist(times, volumeRaw, 0)
    const rsi14 = alignLine(times, rsi14Raw, 50)
    const macdLine = alignLine(times, macdLineRaw, 0)
    const signalLine = alignLine(times, signalLineRaw, 0)
    const hist = alignHist(times, histRaw, 0)

    const map = new Map<UTCTimestamp, HoverState>()
    const put = (t: UTCTimestamp, patch: Partial<HoverState>) => {
      const prev = map.get(t) ?? { t }
      map.set(t, { ...prev, ...patch, t })
    }
    for (const p of price) put(p.time as UTCTimestamp, { price: p.value })
    for (const p of ema20) put(p.time as UTCTimestamp, { ema20: p.value })
    for (const p of sma60) put(p.time as UTCTimestamp, { sma60: p.value })
    for (const p of bbMb) put(p.time as UTCTimestamp, { bbMb: p.value })
    for (const p of bbUb) put(p.time as UTCTimestamp, { bbUb: p.value })
    for (const p of bbLb) put(p.time as UTCTimestamp, { bbLb: p.value })
    for (const p of bbBw) put(p.time as UTCTimestamp, { bbBw: p.value })
    for (const p of volume) put(p.time as UTCTimestamp, { volume: p.value })
    for (const p of rsi14) put(p.time as UTCTimestamp, { rsi14: p.value })
    for (const p of macdLine) put(p.time as UTCTimestamp, { macd: p.value })
    for (const p of signalLine) put(p.time as UTCTimestamp, { signal: p.value })
    for (const p of hist) put(p.time as UTCTimestamp, { hist: p.value })

    return { price, ema20, sma60, bbMb, bbUb, bbLb, bbBw, volume, rsi14, macdLine, signalLine, hist, map }
  }, [series])

  useEffect(() => {
    if (!priceElRef.current || chartsRef.current.price) return

    const charts = chartsRef.current
    const seriesApi = seriesRef.current
    const chart = createChart(priceElRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#111B2E' },
        textColor: '#A9B6CC',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)', minimumWidth: PANE_SCALE_MIN_WIDTH },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })

    const priceSeries = chart.addSeries(LineSeries, {
      color: '#60A5FA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    const sma60Series = chart.addSeries(LineSeries, {
      color: '#A78BFA',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })

    const bbMbSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    const bbUbSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.25)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    const bbLbSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.25)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })

    charts.price = chart
    seriesApi.price = priceSeries
    seriesApi.ema20 = ema20Series
    seriesApi.sma60 = sma60Series
    seriesApi.mb = bbMbSeries
    seriesApi.ub = bbUbSeries
    seriesApi.lb = bbLbSeries

    return () => {
      chart.remove()
      if (charts.price === chart) charts.price = null
      seriesApi.price = null
      seriesApi.ema20 = null
      seriesApi.sma60 = null
      seriesApi.mb = null
      seriesApi.ub = null
      seriesApi.lb = null
    }
  }, [])

  useEffect(() => {
    if (!volElRef.current || chartsRef.current.volume) return
    const charts = chartsRef.current
    const seriesApi = seriesRef.current
    const chart = createChart(volElRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#111B2E' },
        textColor: '#A9B6CC',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)', minimumWidth: PANE_SCALE_MIN_WIDTH },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#A9B6CC',
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => formatCompactNumber(v) },
    })
    charts.volume = chart
    seriesApi.volume = volumeSeries
    return () => {
      chart.remove()
      if (charts.volume === chart) charts.volume = null
      seriesApi.volume = null
    }
  }, [])

  useEffect(() => {
    if (!rsiElRef.current || chartsRef.current.rsi) return
    const charts = chartsRef.current
    const seriesApi = seriesRef.current
    const chart = createChart(rsiElRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor: '#A9B6CC',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)', minimumWidth: PANE_SCALE_MIN_WIDTH },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#34D399',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 2) },
    })
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(255,255,255,0.28)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '30',
    })
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(255,255,255,0.28)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '70',
    })
    charts.rsi = chart
    seriesApi.rsi14 = rsiSeries
    requestAnimationFrame(updateRsiZoneBg)
    return () => {
      chart.remove()
      if (charts.rsi === chart) charts.rsi = null
      seriesApi.rsi14 = null
    }
  }, [])

  useEffect(() => {
    if (!macdElRef.current || chartsRef.current.macd) return
    const charts = chartsRef.current
    const seriesApi = seriesRef.current
    const chart = createChart(macdElRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#111B2E' },
        textColor: '#A9B6CC',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.10)', minimumWidth: PANE_SCALE_MIN_WIDTH },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })
    const histSeries = chart.addSeries(HistogramSeries, {
      color: '#A9B6CC',
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    const macdSeries = chart.addSeries(LineSeries, {
      color: '#60A5FA',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    const signalSeries = chart.addSeries(LineSeries, {
      color: '#F472B6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'custom', formatter: (v) => trimFixed(v, 3) },
    })
    charts.macd = chart
    seriesApi.hist = histSeries
    seriesApi.macd = macdSeries
    seriesApi.signal = signalSeries
    return () => {
      chart.remove()
      if (charts.macd === chart) charts.macd = null
      seriesApi.hist = null
      seriesApi.macd = null
      seriesApi.signal = null
    }
  }, [])

  useEffect(() => {
    const price = chartsRef.current.price
    const volume = chartsRef.current.volume
    const rsi = chartsRef.current.rsi
    const macd = chartsRef.current.macd
    if (!price) return

    const axisChart = showMacd ? macd : showRsi ? rsi : showVolume ? volume : price
    const charts: IChartApi[] = [price, volume, rsi, macd].filter(Boolean) as IChartApi[]
    for (const c of charts) {
      c.applyOptions({
        timeScale: {
          borderColor: 'rgba(255,255,255,0.10)',
          visible: axisChart != null && c === axisChart,
        },
      })
    }
  }, [showMacd, showRsi, showVolume])

  useEffect(() => {
    seriesRef.current.price?.setData(data.price)
    seriesRef.current.ema20?.setData(data.ema20)
    seriesRef.current.sma60?.setData(data.sma60)
    seriesRef.current.mb?.setData(data.bbMb)
    seriesRef.current.ub?.setData(data.bbUb)
    seriesRef.current.lb?.setData(data.bbLb)
    seriesRef.current.volume?.setData(data.volume)
    seriesRef.current.rsi14?.setData(data.rsi14)
    seriesRef.current.macd?.setData(data.macdLine)
    seriesRef.current.signal?.setData(data.signalLine)
    seriesRef.current.hist?.setData(data.hist)

    if (chartsRef.current.price) {
      chartsRef.current.price.timeScale().fitContent()
    }
    requestAnimationFrame(updateRsiZoneBg)
  }, [data])

  useEffect(() => {
    seriesRef.current.ema20?.applyOptions({ visible: showEma20 })
  }, [showEma20])

  useEffect(() => {
    seriesRef.current.sma60?.applyOptions({ visible: showSma60 })
  }, [showSma60])

  useEffect(() => {
    const s = seriesRef.current
    s.mb?.applyOptions({ visible: showBB })
    s.ub?.applyOptions({ visible: showBB })
    s.lb?.applyOptions({ visible: showBB })
  }, [showBB])

  useEffect(() => {
    const charts: IChartApi[] = [
      chartsRef.current.price,
      chartsRef.current.volume,
      chartsRef.current.rsi,
      chartsRef.current.macd,
    ].filter(Boolean) as IChartApi[]

    if (charts.length === 0) return

    const onVisibleLogicalRange = (src: IChartApi) => (range: LogicalRange | null) => {
      if (syncingRef.current) return
      if (!range) return
      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        c.timeScale().setVisibleLogicalRange(range)
      }
      syncingRef.current = false
      requestAnimationFrame(updateRsiZoneBg)
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

      const next = data.map.get(t) ?? { t }
      setHover(next)

      const priceSeries = seriesRef.current.price
      const volSeries = seriesRef.current.volume
      const rsiSeries = seriesRef.current.rsi14
      const macdSeries = seriesRef.current.macd
      const histSeries = seriesRef.current.hist
      const signalSeries = seriesRef.current.signal

      syncingRef.current = true
      for (const c of charts) {
        if (c === src) continue
        if (c === chartsRef.current.price && priceSeries && typeof next.price === 'number') {
          c.setCrosshairPosition(next.price, t, priceSeries)
        } else if (c === chartsRef.current.volume && volSeries && typeof next.volume === 'number') {
          c.setCrosshairPosition(next.volume, t, volSeries)
        } else if (c === chartsRef.current.rsi && rsiSeries && typeof next.rsi14 === 'number') {
          c.setCrosshairPosition(next.rsi14, t, rsiSeries)
        } else if (c === chartsRef.current.macd) {
          if (histSeries && typeof next.hist === 'number') {
            c.setCrosshairPosition(next.hist, t, histSeries)
          } else if (macdSeries && typeof next.macd === 'number') {
            c.setCrosshairPosition(next.macd, t, macdSeries)
          } else if (signalSeries && typeof next.signal === 'number') {
            c.setCrosshairPosition(next.signal, t, signalSeries)
          } else {
            c.clearCrosshairPosition()
          }
        } else {
          c.clearCrosshairPosition()
        }
      }
      syncingRef.current = false
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
      typeof ResizeObserver === 'undefined' || !rsiElRef.current
        ? null
        : new ResizeObserver(() => {
            requestAnimationFrame(updateRsiZoneBg)
          })
    if (ro && rsiElRef.current) ro.observe(rsiElRef.current)

    return () => {
      for (const { chart, fn } of rangeHandlers) {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(fn)
      }
      for (const { chart, fn } of crossHandlers) {
        chart.unsubscribeCrosshairMove(fn)
      }
      ro?.disconnect()
    }
  }, [data])

  return (
    <div className="relative">
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
          onClick={() => setShowSma60((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showSma60 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
          SMA60
        </button>
        <button
          type="button"
          onClick={() => setShowBB((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showBB ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.4)]" />
          布林带
        </button>
        <div className="mx-2 h-4 w-px bg-white/10" />
        <button
          type="button"
          onClick={() => setShowVolume((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showVolume ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          成交量
        </button>
        <button
          type="button"
          onClick={() => setShowRsi((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showRsi ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          RSI
        </button>
        <button
          type="button"
          onClick={() => setShowMacd((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
            showMacd ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
          )}
        >
          MACD
        </button>
      </div>

      {hover ? (
        <div className="pointer-events-none absolute right-3 top-10 z-10 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
          <div className="font-mono text-[11px] text-[#A9B6CC]">{timeToUtcYmd(hover.t)}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-[#A9B6CC]">收盘</div>
            <div className="text-right font-mono">{fmt(hover.price, 3)}</div>
            <div className="text-[#A9B6CC]">EMA20</div>
            <div className="text-right font-mono">{fmt(hover.ema20, 3)}</div>
            <div className="text-[#A9B6CC]">SMA60</div>
            <div className="text-right font-mono">{fmt(hover.sma60, 3)}</div>
            {showBB && (
              <>
                <div className="text-[#A9B6CC]">MB</div>
                <div className="text-right font-mono">{fmt(hover.bbMb, 3)}</div>
                <div className="text-[#A9B6CC]">UB</div>
                <div className="text-right font-mono">{fmt(hover.bbUb, 3)}</div>
                <div className="text-[#A9B6CC]">LB</div>
                <div className="text-right font-mono">{fmt(hover.bbLb, 3)}</div>
                <div className="text-[#A9B6CC]">带宽</div>
                <div className="text-right font-mono">
                  {typeof hover.bbBw === 'number' ? (hover.bbBw * 100).toFixed(1) + '%' : '—'}
                </div>
              </>
            )}
            <div className="text-[#A9B6CC]">成交量</div>
            <div className="text-right font-mono">
              {typeof hover.volume === 'number' ? formatCompactNumber(hover.volume) : '—'}
            </div>
            <div className="text-[#A9B6CC]">RSI14</div>
            <div className="text-right font-mono">{fmt(hover.rsi14, 2)}</div>
            <div className="text-[#A9B6CC]">MACD</div>
            <div className="text-right font-mono">{fmt(hover.macd, 3)}</div>
            <div className="text-[#A9B6CC]">Signal</div>
            <div className="text-right font-mono">{fmt(hover.signal, 3)}</div>
            <div className="text-[#A9B6CC]">Hist</div>
            <div className="text-right font-mono">{fmt(hover.hist, 3)}</div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="relative rounded-lg border border-white/10 bg-[#111B2E] pt-6">
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            价格（前复权）+ EMA20 + SMA60 {showBB && '+ 布林带'}
          </div>
          <div ref={priceElRef} className="h-[280px] w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showVolume ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showVolume ? 110 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            成交量（周）
          </div>
          <div ref={volElRef} className="h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showRsi ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showRsi ? 110 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            RSI（14，周）
          </div>
          <div
            ref={rsiOverboughtBgRef}
            className="pointer-events-none absolute left-0 top-0 z-0 bg-[rgba(239,68,68,0.14)]"
            style={{ right: PANE_SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div
            ref={rsiOversoldBgRef}
            className="pointer-events-none absolute left-0 top-0 z-0 bg-[rgba(16,185,129,0.12)]"
            style={{ right: PANE_SCALE_MIN_WIDTH }}
            aria-hidden="true"
          />
          <div ref={rsiElRef} className="relative z-10 h-full w-full" />
        </div>

        <div
          className={cn(
            'relative rounded-lg border border-white/10 bg-[#111B2E] transition-[height,opacity]',
            showMacd ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ height: showMacd ? 140 : 1 }}
        >
          <div className="pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur">
            MACD（12,26,9，周）
          </div>
          <div ref={macdElRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}

