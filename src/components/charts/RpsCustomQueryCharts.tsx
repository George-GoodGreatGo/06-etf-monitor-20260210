import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { RpsStyleSeriesPoint, RpsTurnoverHistoryPoint } from '@/utils/marketApi'
import { hasValidLogicalRange, normalizeTime, safeClearCrosshair, safeSetCrosshair, safeSetVisibleLogicalRange } from '@/components/charts/chartSyncGuards'
import { cn } from '@/lib/utils'

type Props = {
  ticker: string
  tickerName?: string
  benchmarkName: string
  series: RpsStyleSeriesPoint[]
  turnoverSeries?: RpsTurnoverHistoryPoint[]
  titleLabel?: string
  subtitleLabel?: string
}

type PreparedPoint = {
  time: UTCTimestamp
  date: string
  targetCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
  sma20: number | null
  sma60: number | null
  sma250: number | null
  rsi14: number | null
  turnoverMultipleOfPrev20Avg: number | null
  isAmplified: boolean
}

type ChartDatum = LineData<Time> | { time: Time }
type BackgroundBand = { top: number; bottom: number; color: string }
type PriceTone = 'negative' | 'neutral' | 'positive' | 'strong'
type PriceRun = { tone: PriceTone; data: LineData<Time>[] }
type PaneVisibilityState = {
  showScorePane: boolean
  showRelativePane: boolean
  showRsiPane: boolean
}

const LINE_COLOR = '#60A5FA'
const MA_LINE_COLOR = 'rgba(248,250,252,0.62)'
const PRICE_NEGATIVE_COLOR = '#6EE7B7'
const PRICE_NEUTRAL_COLOR = '#F4D35E'
const PRICE_POSITIVE_COLOR = '#F5A65B'
const PRICE_STRONG_COLOR = '#F38B8F'
const PRICE_ALIGN_COLOR = 'rgba(0,0,0,0)'
const SMA20_LINE_COLOR = '#F59E0B'
const SMA60_LINE_COLOR = 'rgba(147,197,253,0.95)'
const SMA250_LINE_COLOR = 'rgba(226,232,240,0.72)'
const RSI_LINE_COLOR = '#B9A3FF'
const TURNOVER_MARKER_COLOR = '#CBB8FF'
const SCALE_MIN_WIDTH = 110
const PANEL_CLS = 'overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg'
const CHART_PANEL_CLS = 'relative rounded-lg border border-white/10 bg-[#111B2E] pt-6'
const CHART_BADGE_CLS =
  'pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur'
const AXIS_BORDER_COLOR = 'rgba(255,255,255,0.05)'
const DEFAULT_WINDOW_BARS = 252

function formatEtfDisplayLabel(ticker: string, tickerName?: string): string {
  const code = ticker.includes('.') ? ticker.split('.')[0] || ticker : ticker
  const name = String(tickerName || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name && name !== code && name !== ticker) return `${name}（${code}）`
  return code
}

function ymdToUtcSeconds(ymd: string): UTCTimestamp | null {
  const s = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const year = Number(s.slice(0, 4))
  const month = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return Math.floor(Date.UTC(year, month - 1, day) / 1000) as UTCTimestamp
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

function formatValue(value: number | null | undefined, digits = 4): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function buildScoreBgBands(range: { min: number; max: number }): BackgroundBand[] {
  const upper = Math.max(20, range.max) + 10
  const lower = Math.min(-20, range.min) - 10
  return [
    { top: -20, bottom: lower, color: 'rgba(22, 101, 52, 0.18)' },
    { top: -10, bottom: -20, color: 'rgba(21, 128, 61, 0.16)' },
    { top: 0, bottom: -10, color: 'rgba(74, 222, 128, 0.14)' },
    { top: 10, bottom: 0, color: 'rgba(250, 204, 21, 0.14)' },
    { top: 20, bottom: 10, color: 'rgba(251, 146, 60, 0.14)' },
    { top: upper, bottom: 20, color: 'rgba(239, 68, 68, 0.16)' },
  ].filter((band) => band.top !== band.bottom)
}

function resolveBaseIndex(range: LogicalRange | null | undefined, length: number): number {
  if (!hasValidLogicalRange(range) || length <= 0) return 0
  const from = Math.max(0, Math.min(length - 1, Math.ceil(Number(range.from))))
  return Number.isFinite(from) ? from : 0
}

function buildDefaultLogicalRange(length: number, windowBars = DEFAULT_WINDOW_BARS): LogicalRange | null {
  if (length <= 0) return null
  const to = Math.max(0, length - 1)
  const from = Math.max(0, length - Math.max(2, windowBars))
  return { from, to } as LogicalRange
}

function clampLogicalRange(range: LogicalRange | null | undefined, length: number): LogicalRange | null {
  if (!hasValidLogicalRange(range) || length <= 0) return null
  const maxIndex = Math.max(0, length - 1)
  let from = Number(range.from)
  let to = Number(range.to)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  if (from > to) [from, to] = [to, from]
  const span = Math.max(1, to - from)
  if (span >= maxIndex) return { from: 0, to: maxIndex } as LogicalRange
  if (from < 0) {
    to -= from
    from = 0
  }
  if (to > maxIndex) {
    from -= to - maxIndex
    to = maxIndex
  }
  from = Math.max(0, from)
  to = Math.min(maxIndex, to)
  if (from >= to) {
    from = Math.max(0, to - 1)
  }
  return { from, to } as LogicalRange
}

function rangesClose(a: LogicalRange | null | undefined, b: LogicalRange | null | undefined): boolean {
  if (!hasValidLogicalRange(a) || !hasValidLogicalRange(b)) return false
  return Math.abs(Number(a.from) - Number(b.from)) < 0.01 && Math.abs(Number(a.to) - Number(b.to)) < 0.01
}

function toWhitespacePoint(time: Time): ChartDatum {
  return { time }
}

function buildSma(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    sum += value
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

function computeRsiValue(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50
  if (avgLoss === 0) return 100
  if (avgGain === 0) return 0
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function buildRsi(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length <= window) return out

  let gains = 0
  let losses = 0
  for (let i = 1; i <= window; i += 1) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }
  let avgGain = gains / window
  let avgLoss = losses / window
  out[window] = computeRsiValue(avgGain, avgLoss)

  for (let i = window + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (window - 1) + gain) / window
    avgLoss = (avgLoss * (window - 1) + loss) / window
    out[i] = computeRsiValue(avgGain, avgLoss)
  }

  return out
}

function getNumericDatumValue(point: ChartDatum): number | null {
  const value = (point as { value?: unknown }).value
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function resolvePriceTone(score: number | null | undefined): PriceTone {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'neutral'
  if (score < 0) return 'negative'
  if (score <= 10) return 'neutral'
  if (score <= 20) return 'positive'
  return 'strong'
}

function buildPriceRuns(points: PreparedPoint[]): PriceRun[] {
  if (!points.length) return []
  if (points.length === 1) {
    return [
      {
        tone: resolvePriceTone(points[0].scorePct),
        data: [{ time: points[0].time, value: points[0].targetCloseQfq }],
      },
    ]
  }
  const runs: PriceRun[] = []
  let runStart = 1
  let runTone = resolvePriceTone(points[1].scorePct)
  const pushRun = (start: number, endInclusive: number, tone: PriceTone) => {
    if (start > endInclusive) return
    const startIndex = Math.max(0, start - 1)
    const data: LineData<Time>[] = []
    for (let i = startIndex; i <= endInclusive; i += 1) {
      data.push({ time: points[i].time, value: points[i].targetCloseQfq })
    }
    runs.push({ tone, data })
  }
  for (let i = 2; i < points.length; i += 1) {
    const tone = resolvePriceTone(points[i].scorePct)
    if (tone === runTone) continue
    pushRun(runStart, i - 1, runTone)
    runStart = i
    runTone = tone
  }
  pushRun(runStart, points.length - 1, runTone)
  return runs
}

function buildRelativeData(
  points: PreparedPoint[],
  range: LogicalRange | null | undefined,
): { rps: ChartDatum[]; ma50: ChartDatum[] } {
  if (!points.length) return { rps: [], ma50: [] }
  let baseIndex = resolveBaseIndex(range, points.length)
  while (baseIndex < points.length && (!Number.isFinite(points[baseIndex]?.rpsRaw) || points[baseIndex].rpsRaw === 0)) {
    baseIndex += 1
  }
  const base = points[baseIndex]?.rpsRaw
  if (typeof base !== 'number' || !Number.isFinite(base) || base === 0) {
    return {
      rps: points.map((point) => toWhitespacePoint(point.time)),
      ma50: points.map((point) => toWhitespacePoint(point.time)),
    }
  }
  const rps: ChartDatum[] = []
  const ma50: ChartDatum[] = []
  for (const point of points) {
    const rawValue = point.rpsRaw / base
    rps.push(Number.isFinite(rawValue) ? { time: point.time, value: rawValue } : toWhitespacePoint(point.time))
    const ma50Value =
      typeof point.rpsMa50 === 'number' && Number.isFinite(point.rpsMa50) ? point.rpsMa50 / base : Number.NaN
    ma50.push(Number.isFinite(ma50Value) ? { time: point.time, value: ma50Value } : toWhitespacePoint(point.time))
  }
  return { rps, ma50 }
}

function buildRsiBgBands(): BackgroundBand[] {
  return [
    { top: 100, bottom: 70, color: 'rgba(239, 68, 68, 0.14)' },
    { top: 30, bottom: 0, color: 'rgba(34, 197, 94, 0.14)' },
  ]
}

function createBaseChart(host: HTMLDivElement, opts?: { showTimeScale?: boolean }): IChartApi {
  return createChart(host, {
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
      borderColor: AXIS_BORDER_COLOR,
      minimumWidth: SCALE_MIN_WIDTH,
    },
    timeScale: {
      borderColor: AXIS_BORDER_COLOR,
      visible: opts?.showTimeScale ?? false,
      fixLeftEdge: true,
      fixRightEdge: true,
      rightOffset: 0,
      minBarSpacing: 0.6,
      allowBoldLabels: false,
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
    handleScale: {
      mouseWheel: true,
      axisPressedMouseMove: true,
      pinch: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
  })
}

function usePriceChart(
  hostRef: RefObject<HTMLDivElement | null>,
  prepared: PreparedPoint[],
  opts?: {
    resetKey?: string
    showPriceLine?: boolean
    showSma20?: boolean
    showSma60?: boolean
    showSma250?: boolean
  },
) {
  const chartRef = useRef<IChartApi | null>(null)
  const alignSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const sma20SeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const sma60SeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const sma250SeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const coloredSeriesRefs = useRef<Array<ISeriesApi<'Line', Time>>>([])
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const didFitRef = useRef(false)
  const latestValue = useMemo(() => {
    for (let i = prepared.length - 1; i >= 0; i -= 1) {
      const value = prepared[i]?.targetCloseQfq
      if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return null
  }, [prepared])
  const priceData = useMemo<LineData<Time>[]>(() => prepared.map((point) => ({ time: point.time, value: point.targetCloseQfq })), [prepared])
  const sma20Data = useMemo<ChartDatum[]>(
    () =>
      prepared.map((point) =>
        typeof point.sma20 === 'number' && Number.isFinite(point.sma20) ? { time: point.time, value: point.sma20 } : toWhitespacePoint(point.time),
      ),
    [prepared],
  )
  const sma60Data = useMemo<ChartDatum[]>(
    () =>
      prepared.map((point) =>
        typeof point.sma60 === 'number' && Number.isFinite(point.sma60) ? { time: point.time, value: point.sma60 } : toWhitespacePoint(point.time),
      ),
    [prepared],
  )
  const sma250Data = useMemo<ChartDatum[]>(
    () =>
      prepared.map((point) =>
        typeof point.sma250 === 'number' && Number.isFinite(point.sma250) ? { time: point.time, value: point.sma250 } : toWhitespacePoint(point.time),
      ),
    [prepared],
  )
  const priceRuns = useMemo(() => buildPriceRuns(prepared), [prepared])
  const turnoverMarkers = useMemo<SeriesMarker<Time>[]>(
    () =>
      prepared
        .filter((point) => point.isAmplified)
        .map((point) => ({
          id: `${point.date}-turnover`,
          time: point.time,
          position: 'atPriceMiddle',
          price: point.targetCloseQfq,
          shape: 'circle',
          color: TURNOVER_MARKER_COLOR,
          size: 1.2,
        })),
    [prepared],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host || chartRef.current) return
    const chart = createBaseChart(host)
    const alignSeries = chart.addSeries(LineSeries, {
      color: PRICE_ALIGN_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const sma20Series = chart.addSeries(LineSeries, {
      color: SMA20_LINE_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const sma60Series = chart.addSeries(LineSeries, {
      color: SMA60_LINE_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const sma250Series = chart.addSeries(LineSeries, {
      color: SMA250_LINE_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    chartRef.current = chart
    alignSeriesRef.current = alignSeries
    sma20SeriesRef.current = sma20Series
    sma60SeriesRef.current = sma60Series
    sma250SeriesRef.current = sma250Series
    return () => {
      chart.remove()
      chartRef.current = null
      alignSeriesRef.current = null
      sma20SeriesRef.current = null
      sma60SeriesRef.current = null
      sma250SeriesRef.current = null
      coloredSeriesRefs.current = []
      markersRef.current = null
    }
  }, [hostRef])

  useEffect(() => {
    const chart = chartRef.current
    const alignSeries = alignSeriesRef.current
    const sma20Series = sma20SeriesRef.current
    const sma60Series = sma60SeriesRef.current
    const sma250Series = sma250SeriesRef.current
    if (!chart || !alignSeries || !sma20Series || !sma60Series || !sma250Series) return

    alignSeries.setData(priceData as never)
    sma20Series.setData(sma20Data as never)
    sma60Series.setData(sma60Data as never)
    sma250Series.setData(sma250Data as never)
    sma20Series.applyOptions({ visible: opts?.showSma20 ?? true })
    sma60Series.applyOptions({ visible: opts?.showSma60 ?? true })
    sma250Series.applyOptions({ visible: opts?.showSma250 ?? true })

    for (const series of coloredSeriesRefs.current) chart.removeSeries(series)
    coloredSeriesRefs.current = []
    for (const run of priceRuns) {
      const series = chart.addSeries(LineSeries, {
        color:
          run.tone === 'negative'
            ? PRICE_NEGATIVE_COLOR
            : run.tone === 'positive'
              ? PRICE_POSITIVE_COLOR
              : run.tone === 'strong'
                ? PRICE_STRONG_COLOR
                : PRICE_NEUTRAL_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      series.setData(run.data as never)
      series.applyOptions({ visible: opts?.showPriceLine ?? true })
      coloredSeriesRefs.current.push(series)
    }

    if (markersRef.current) markersRef.current.setMarkers(turnoverMarkers)
    else markersRef.current = createSeriesMarkers(alignSeries, turnoverMarkers, { zOrder: 'aboveSeries' })

    if (!didFitRef.current && priceData.length > 0) {
      chart.timeScale().fitContent()
      didFitRef.current = true
    }
  }, [opts?.showPriceLine, opts?.showSma20, opts?.showSma60, opts?.showSma250, priceData, priceRuns, sma20Data, sma60Data, sma250Data, turnoverMarkers])

  useEffect(() => {
    didFitRef.current = false
    const chart = chartRef.current
    if (!chart || priceData.length === 0) return
    chart.timeScale().fitContent()
    didFitRef.current = true
  }, [priceData, opts?.resetKey])

  return {
    chartRef,
    seriesRef: alignSeriesRef,
    latestValue: formatValue(latestValue, 4),
  }
}

function useSingleLineChart(
  hostRef: RefObject<HTMLDivElement | null>,
  primaryData: ChartDatum[],
  opts?: {
    overlayData?: ChartDatum[]
    backgroundBands?: BackgroundBand[]
    baselinePrice?: number
    digits?: number
    primaryColor?: string
    resetKey?: string
    showTimeScale?: boolean
  },
) {
  const chartRef = useRef<IChartApi | null>(null)
  const primarySeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const overlaySeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const backgroundRefs = useRef<Array<ISeriesApi<'Baseline', Time>>>([])
  const didFitRef = useRef(false)
  const baselineCreatedRef = useRef(false)
  const latestValue = useMemo(() => {
    for (let i = primaryData.length - 1; i >= 0; i -= 1) {
      const datum = primaryData[i] as { value?: unknown }
      if (typeof datum?.value === 'number' && Number.isFinite(datum.value)) return datum.value
    }
    return null
  }, [primaryData])

  useEffect(() => {
    const host = hostRef.current
    if (!host || chartRef.current) return
    const chart = createBaseChart(host, { showTimeScale: opts?.showTimeScale })
    const series = chart.addSeries(LineSeries, {
      color: opts?.primaryColor ?? LINE_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    const overlaySeries = chart.addSeries(LineSeries, {
      color: MA_LINE_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    chartRef.current = chart
    primarySeriesRef.current = series
    overlaySeriesRef.current = overlaySeries
    return () => {
      chart.remove()
      chartRef.current = null
      primarySeriesRef.current = null
      overlaySeriesRef.current = null
      backgroundRefs.current = []
    }
  }, [hostRef, opts?.primaryColor, opts?.showTimeScale])

  useEffect(() => {
    const chart = chartRef.current
    const series = primarySeriesRef.current
    const overlaySeries = overlaySeriesRef.current
    if (!chart || !series || !overlaySeries) return
    for (const band of backgroundRefs.current) chart.removeSeries(band)
    backgroundRefs.current = []
    if (Array.isArray(opts?.backgroundBands) && opts.backgroundBands.length > 0) {
      let minTime = Number.POSITIVE_INFINITY
      let maxTime = Number.NEGATIVE_INFINITY
      for (const point of primaryData) {
        const t = Number(point.time)
        if (!Number.isFinite(t)) continue
        if (t < minTime) minTime = t
        if (t > maxTime) maxTime = t
      }
      if (Number.isFinite(minTime) && Number.isFinite(maxTime) && minTime <= maxTime) {
        for (const band of opts.backgroundBands) {
          const top = Math.max(band.top, band.bottom)
          const bottom = Math.min(band.top, band.bottom)
          const bgSeries = chart.addSeries(BaselineSeries, {
            baseValue: { type: 'price', price: bottom },
            topLineColor: 'rgba(0,0,0,0)',
            topFillColor1: band.color,
            topFillColor2: band.color,
            bottomLineColor: 'rgba(0,0,0,0)',
            bottomFillColor1: 'rgba(0,0,0,0)',
            bottomFillColor2: 'rgba(0,0,0,0)',
            priceLineVisible: false,
            lastValueVisible: false,
          })
          bgSeries.setData([
            { time: minTime as UTCTimestamp, value: top },
            { time: maxTime as UTCTimestamp, value: top },
          ])
          backgroundRefs.current.push(bgSeries)
        }
      }
    }
    series.setData(primaryData as never)
    overlaySeries.setData((opts?.overlayData ?? []) as never)
    if (!didFitRef.current && primaryData.length > 0) {
      chart.timeScale().fitContent()
      didFitRef.current = true
    }
    if (typeof opts?.baselinePrice === 'number' && Number.isFinite(opts.baselinePrice)) {
      if (baselineCreatedRef.current) return
      series.createPriceLine({
        price: opts.baselinePrice,
        color: 'rgba(169,182,204,0.35)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: '',
      })
      baselineCreatedRef.current = true
    }
  }, [primaryData, opts?.overlayData, opts?.backgroundBands, opts?.baselinePrice])

  useEffect(() => {
    didFitRef.current = false
    const chart = chartRef.current
    if (!chart || primaryData.length === 0) return
    chart.timeScale().fitContent()
    didFitRef.current = true
  }, [primaryData, opts?.resetKey])

  return {
    chartRef,
    seriesRef: primarySeriesRef,
    overlaySeriesRef,
    latestValue: formatValue(latestValue, opts?.digits ?? 4),
  }
}

export default function RpsCustomQueryCharts({
  ticker,
  tickerName,
  benchmarkName,
  series,
  turnoverSeries = [],
  titleLabel,
  subtitleLabel,
}: Props) {
  const priceHostRef = useRef<HTMLDivElement | null>(null)
  const scoreHostRef = useRef<HTMLDivElement | null>(null)
  const relativeHostRef = useRef<HTMLDivElement | null>(null)
  const rsiHostRef = useRef<HTMLDivElement | null>(null)
  const syncingRangeRef = useRef(false)
  const syncingCrosshairRef = useRef(false)
  const visibleRangeRef = useRef<LogicalRange | null>(null)
  const replaySyncRafRef = useRef<number[]>([])
  const replaySyncCycleRef = useRef(0)
  const prevPaneVisibleRef = useRef<PaneVisibilityState>({
    showScorePane: true,
    showRelativePane: true,
    showRsiPane: true,
  })
  const [hoverTime, setHoverTime] = useState<UTCTimestamp | null>(null)
  const [showPriceLine, setShowPriceLine] = useState(true)
  const [showSma20, setShowSma20] = useState(true)
  const [showSma60, setShowSma60] = useState(true)
  const [showSma250, setShowSma250] = useState(true)
  const [showScorePane, setShowScorePane] = useState(true)
  const [showRelativePane, setShowRelativePane] = useState(true)
  const [showRsiPane, setShowRsiPane] = useState(true)

  const prepared = useMemo<PreparedPoint[]>(() => {
    const turnoverMap = new Map<string, number | null>()
    for (const point of turnoverSeries) {
      turnoverMap.set(point.date, point.turnoverMultipleOfPrev20Avg ?? null)
    }
    const basePoints = series
      .map((point) => {
        const time = ymdToUtcSeconds(point.date)
        if (!time || typeof point.targetCloseQfq !== 'number' || !Number.isFinite(point.targetCloseQfq)) return null
        return {
          time,
          date: point.date,
          targetCloseQfq: point.targetCloseQfq,
          rpsRaw: point.rpsRaw,
          rpsMa50: point.rpsMa50,
          scorePct: point.scorePct,
          sma20: null,
          sma60: null,
          sma250: null,
          rsi14: null,
          turnoverMultipleOfPrev20Avg: null,
          isAmplified: false,
        }
      })
      .filter((point): point is PreparedPoint => Boolean(point))
    const priceValues = basePoints.map((point) => point.targetCloseQfq)
    const sma20 = buildSma(priceValues, 20)
    const sma60 = buildSma(priceValues, 60)
    const sma250 = buildSma(priceValues, 250)
    const rsi14 = buildRsi(priceValues, 14)
    return basePoints.map((point, index) => {
      const turnoverMultipleOfPrev20Avg = turnoverMap.get(point.date) ?? null
      return {
        ...point,
        sma20: sma20[index] ?? null,
        sma60: sma60[index] ?? null,
        sma250: sma250[index] ?? null,
        rsi14: rsi14[index] ?? null,
        turnoverMultipleOfPrev20Avg,
        isAmplified:
          typeof turnoverMultipleOfPrev20Avg === 'number' && Number.isFinite(turnoverMultipleOfPrev20Avg) && turnoverMultipleOfPrev20Avg >= 1.5,
      }
    })
  }, [series, turnoverSeries])

  const scoreData = useMemo<ChartDatum[]>(() => {
    return prepared.map((point) =>
      typeof point.scorePct === 'number' && Number.isFinite(point.scorePct)
        ? { time: point.time, value: point.scorePct }
        : toWhitespacePoint(point.time),
    )
  }, [prepared])
  const rsiData = useMemo<ChartDatum[]>(() => {
    return prepared.map((point) =>
      typeof point.rsi14 === 'number' && Number.isFinite(point.rsi14) ? { time: point.time, value: point.rsi14 } : toWhitespacePoint(point.time),
    )
  }, [prepared])
  const scoreRange = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const point of prepared) {
      if (typeof point.scorePct !== 'number' || !Number.isFinite(point.scorePct)) continue
      if (point.scorePct < min) min = point.scorePct
      if (point.scorePct > max) max = point.scorePct
    }
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null
  }, [prepared])
  const [relativeData, setRelativeData] = useState<{ rps: ChartDatum[]; ma50: ChartDatum[] }>({ rps: [], ma50: [] })

  const hoverPointMap = useMemo(() => {
    const map = new Map<UTCTimestamp, PreparedPoint>()
    for (const point of prepared) map.set(point.time, point)
    return map
  }, [prepared])
  const relativeValueMap = useMemo(() => {
    const map = new Map<UTCTimestamp, number>()
    for (const point of relativeData.rps) {
      const value = getNumericDatumValue(point)
      if (typeof point.time !== 'number' || value == null) continue
      map.set(point.time as UTCTimestamp, value)
    }
    return map
  }, [relativeData])
  const relativeMa50ValueMap = useMemo(() => {
    const map = new Map<UTCTimestamp, number>()
    for (const point of relativeData.ma50) {
      const value = getNumericDatumValue(point)
      if (typeof point.time !== 'number' || value == null) continue
      map.set(point.time as UTCTimestamp, value)
    }
    return map
  }, [relativeData])
  const rsiValueMap = useMemo(() => {
    const map = new Map<UTCTimestamp, number>()
    for (const point of rsiData) {
      const value = getNumericDatumValue(point)
      if (typeof point.time !== 'number' || value == null) continue
      map.set(point.time as UTCTimestamp, value)
    }
    return map
  }, [rsiData])
  const hoverPoint = hoverTime ? hoverPointMap.get(hoverTime) ?? null : null
  const hoverRelativeValue = hoverTime ? relativeValueMap.get(hoverTime) ?? null : null
  const hoverRelativeMa50Value = hoverTime ? relativeMa50ValueMap.get(hoverTime) ?? null : null
  const hoverRsiValue = hoverTime ? rsiValueMap.get(hoverTime) ?? null : null
  const displayTickerLabel = useMemo(() => formatEtfDisplayLabel(ticker, tickerName), [ticker, tickerName])
  const priceChart = usePriceChart(priceHostRef, prepared, {
    resetKey: ticker,
    showPriceLine,
    showSma20,
    showSma60,
    showSma250,
  })
  const scoreChart = useSingleLineChart(scoreHostRef, scoreData, {
    baselinePrice: 0,
    digits: 2,
    resetKey: ticker,
    backgroundBands: scoreRange ? buildScoreBgBands(scoreRange) : [],
  })
  const relativeChart = useSingleLineChart(relativeHostRef, relativeData.rps, {
    overlayData: relativeData.ma50,
    baselinePrice: 1,
    digits: 4,
    resetKey: ticker,
  })
  const rsiChart = useSingleLineChart(rsiHostRef, rsiData, {
    digits: 2,
    resetKey: ticker,
    backgroundBands: buildRsiBgBands(),
    primaryColor: RSI_LINE_COLOR,
    showTimeScale: true,
  })
  const clearReplaySyncQueue = useCallback(() => {
    replaySyncCycleRef.current += 1
    for (const id of replaySyncRafRef.current) cancelAnimationFrame(id)
    replaySyncRafRef.current = []
  }, [])
  const scheduleReplaySyncRaf = useCallback((cycle: number, cb: () => void) => {
    let rafId = 0
    rafId = requestAnimationFrame(() => {
      replaySyncRafRef.current = replaySyncRafRef.current.filter((id) => id !== rafId)
      if (cycle !== replaySyncCycleRef.current) return
      cb()
    })
    replaySyncRafRef.current.push(rafId)
  }, [])
  const syncVisibleRangeToVisiblePanes = useCallback((): boolean => {
    const price = priceChart.chartRef.current
    if (!price) return false
    const range = visibleRangeRef.current ?? price.timeScale().getVisibleLogicalRange()
    const nextRange = clampLogicalRange(range, prepared.length)
    if (!nextRange) return false
    visibleRangeRef.current = nextRange
    if (showScorePane) safeSetVisibleLogicalRange(scoreChart.chartRef.current, nextRange)
    if (showRelativePane) safeSetVisibleLogicalRange(relativeChart.chartRef.current, nextRange)
    if (showRsiPane) safeSetVisibleLogicalRange(rsiChart.chartRef.current, nextRange)
    return true
  }, [prepared.length, priceChart.chartRef, relativeChart.chartRef, rsiChart.chartRef, scoreChart.chartRef, showRelativePane, showRsiPane, showScorePane])
  const scheduleCompensatedPaneSync = useCallback(
    (nextPaneVisible?: PaneVisibilityState) => {
      clearReplaySyncQueue()
      const cycle = replaySyncCycleRef.current
      let attempt = 0
      const maxAttempts = 5
      const run = () => {
        if (cycle !== replaySyncCycleRef.current) return
        const synced = syncVisibleRangeToVisiblePanes()
        if (synced || attempt >= maxAttempts) {
          if (nextPaneVisible && cycle === replaySyncCycleRef.current) prevPaneVisibleRef.current = nextPaneVisible
          return
        }
        attempt += 1
        scheduleReplaySyncRaf(cycle, run)
      }
      scheduleReplaySyncRaf(cycle, () => {
        scheduleReplaySyncRaf(cycle, run)
      })
    },
    [clearReplaySyncQueue, scheduleReplaySyncRaf, syncVisibleRangeToVisiblePanes],
  )

  useEffect(() => {
    const nextRelative = buildRelativeData(prepared, visibleRangeRef.current)
    setRelativeData(nextRelative)
  }, [prepared])

  useEffect(() => {
    const price = priceChart.chartRef.current
    const score = scoreChart.chartRef.current
    const relative = relativeChart.chartRef.current
    const rsi = rsiChart.chartRef.current
    if (!price) return
    const charts: IChartApi[] = [price]
    if (showScorePane && score) charts.push(score)
    if (showRelativePane && relative) charts.push(relative)
    if (showRsiPane && rsi) charts.push(rsi)
    const unsubs: Array<() => void> = []
    charts.forEach((chart, index) => {
      const onRangeChange = (range: LogicalRange | null) => {
        if (syncingRangeRef.current || !hasValidLogicalRange(range)) return
        const nextRange = clampLogicalRange(range, prepared.length)
        if (!nextRange) return
        syncingRangeRef.current = true
        visibleRangeRef.current = nextRange
        setRelativeData(buildRelativeData(prepared, nextRange))
        try {
          if (!rangesClose(range, nextRange)) safeSetVisibleLogicalRange(chart, nextRange)
          charts.forEach((other, otherIndex) => {
            if (otherIndex !== index) safeSetVisibleLogicalRange(other, nextRange)
          })
        } finally {
          syncingRangeRef.current = false
        }
      }
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange)
      unsubs.push(() => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange))
    })
    return () => {
      for (const unsubscribe of unsubs) unsubscribe()
    }
  }, [prepared, priceChart.chartRef, relativeChart.chartRef, rsiChart.chartRef, scoreChart.chartRef, showRelativePane, showRsiPane, showScorePane])

  useEffect(() => {
    const price = priceChart.chartRef.current
    const score = scoreChart.chartRef.current
    const relative = relativeChart.chartRef.current
    const rsi = rsiChart.chartRef.current
    if (!price) return
    const charts: IChartApi[] = [price]
    if (showScorePane && score) charts.push(score)
    if (showRelativePane && relative) charts.push(relative)
    if (showRsiPane && rsi) charts.push(rsi)

    const onCrosshair = (src: IChartApi) => (param: { time?: Time } | null) => {
      if (syncingCrosshairRef.current) return
      const time = normalizeTime(param?.time)
      if (!time) {
        setHoverTime(null)
        syncingCrosshairRef.current = true
        try {
          for (const chart of charts) {
            if (chart === src) continue
            safeClearCrosshair(chart)
          }
        } finally {
          syncingCrosshairRef.current = false
        }
        return
      }

      const point = hoverPointMap.get(time)
      if (!point) {
        setHoverTime(null)
        return
      }
      setHoverTime(time)

      const relativeValue = relativeValueMap.get(time)
      const rsiValue = rsiValueMap.get(time)
      syncingCrosshairRef.current = true
      try {
        for (const chart of charts) {
          if (chart === src) continue
          const synced =
            (chart === price && safeSetCrosshair(chart, point.targetCloseQfq, time, priceChart.seriesRef.current)) ||
            (chart === score &&
              safeSetCrosshair(
                chart,
                typeof point.scorePct === 'number' && Number.isFinite(point.scorePct) ? point.scorePct : undefined,
                time,
                scoreChart.seriesRef.current,
              )) ||
            (chart === relative &&
              safeSetCrosshair(
                chart,
                typeof relativeValue === 'number' && Number.isFinite(relativeValue) ? relativeValue : undefined,
                time,
                relativeChart.seriesRef.current,
              )) ||
            (chart === rsi &&
              safeSetCrosshair(chart, typeof rsiValue === 'number' && Number.isFinite(rsiValue) ? rsiValue : undefined, time, rsiChart.seriesRef.current))
          if (!synced) safeClearCrosshair(chart)
        }
      } finally {
        syncingCrosshairRef.current = false
      }
    }

    const crossHandlers = charts.map((chart) => ({ chart, fn: onCrosshair(chart) }))
    for (const { chart, fn } of crossHandlers) {
      chart.subscribeCrosshairMove(fn)
    }
    return () => {
      for (const { chart, fn } of crossHandlers) {
        chart.unsubscribeCrosshairMove(fn)
      }
    }
  }, [
    hoverPointMap,
    priceChart.chartRef,
    priceChart.seriesRef,
    relativeChart.chartRef,
    relativeChart.seriesRef,
    relativeValueMap,
    rsiChart.chartRef,
    rsiChart.seriesRef,
    rsiValueMap,
    scoreChart.chartRef,
    scoreChart.seriesRef,
    showRelativePane,
    showRsiPane,
    showScorePane,
  ])

  useEffect(() => {
    const visiblePanes: Array<'score' | 'relative' | 'rsi'> = []
    if (showScorePane) visiblePanes.push('score')
    if (showRelativePane) visiblePanes.push('relative')
    if (showRsiPane) visiblePanes.push('rsi')
    const lastPane = visiblePanes.length ? visiblePanes[visiblePanes.length - 1] : null
    safeSetTimeScaleVisible(priceChart.chartRef.current, lastPane == null)
    safeSetTimeScaleVisible(scoreChart.chartRef.current, lastPane === 'score')
    safeSetTimeScaleVisible(relativeChart.chartRef.current, lastPane === 'relative')
    safeSetTimeScaleVisible(rsiChart.chartRef.current, lastPane === 'rsi')
    const range = visibleRangeRef.current
    const nextRange = clampLogicalRange(range, prepared.length)
    if (!hasValidLogicalRange(nextRange)) return
    syncingRangeRef.current = true
    try {
      visibleRangeRef.current = nextRange
      safeSetVisibleLogicalRange(priceChart.chartRef.current, nextRange)
      safeSetVisibleLogicalRange(scoreChart.chartRef.current, nextRange)
      safeSetVisibleLogicalRange(relativeChart.chartRef.current, nextRange)
      safeSetVisibleLogicalRange(rsiChart.chartRef.current, nextRange)
    } finally {
      syncingRangeRef.current = false
    }
  }, [prepared.length, priceChart.chartRef, relativeChart.chartRef, rsiChart.chartRef, scoreChart.chartRef, showRelativePane, showRsiPane, showScorePane])

  useEffect(() => {
    const master = priceChart.chartRef.current
    if (!master || !prepared.length) return
    const initialRange = buildDefaultLogicalRange(prepared.length)
    if (!initialRange) return
    visibleRangeRef.current = initialRange
    setRelativeData(buildRelativeData(prepared, initialRange))
    syncingRangeRef.current = true
    try {
      safeSetVisibleLogicalRange(master, initialRange)
      safeSetVisibleLogicalRange(scoreChart.chartRef.current, initialRange)
      safeSetVisibleLogicalRange(relativeChart.chartRef.current, initialRange)
      safeSetVisibleLogicalRange(rsiChart.chartRef.current, initialRange)
    } finally {
      syncingRangeRef.current = false
    }
  }, [prepared, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef, rsiChart.chartRef])

  useEffect(() => {
    const allCharts = [priceChart.chartRef.current, scoreChart.chartRef.current, relativeChart.chartRef.current, rsiChart.chartRef.current]
    syncingCrosshairRef.current = true
    try {
      for (const chart of allCharts) safeClearCrosshair(chart)
    } finally {
      syncingCrosshairRef.current = false
    }
    const prev = prevPaneVisibleRef.current
    const nextPaneVisible: PaneVisibilityState = { showScorePane, showRelativePane, showRsiPane }
    const paneOpened = (!prev.showScorePane && showScorePane) || (!prev.showRelativePane && showRelativePane) || (!prev.showRsiPane && showRsiPane)
    if (paneOpened) {
      scheduleCompensatedPaneSync(nextPaneVisible)
      return
    }
    const synced = syncVisibleRangeToVisiblePanes()
    if (!synced) {
      scheduleCompensatedPaneSync(nextPaneVisible)
      return
    }
    prevPaneVisibleRef.current = nextPaneVisible
  }, [
    priceChart.chartRef,
    relativeChart.chartRef,
    rsiChart.chartRef,
    scheduleCompensatedPaneSync,
    scoreChart.chartRef,
    showRelativePane,
    showRsiPane,
    showScorePane,
    syncVisibleRangeToVisiblePanes,
  ])

  useEffect(() => clearReplaySyncQueue, [clearReplaySyncQueue])

  useEffect(() => {
    setHoverTime(null)
    visibleRangeRef.current = null
    prevPaneVisibleRef.current = { showScorePane: true, showRelativePane: true, showRsiPane: true }
  }, [ticker, prepared])

  return (
    <section className={PANEL_CLS}>
      <div className="border-b border-[#1E293B] px-3 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">{titleLabel || `${displayTickerLabel}关键图表指标`}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-[#94A3B8]">
              主图支持价格线、`SMA20`、`SMA60`、`SMA250` 开关，并保留按 Score 四档分段着色与 `1.50x` 放量淡紫点；副图可按需显示相对 {benchmarkName} 的 RPS Score、RPS 起点归一和 `RSI(14)`。
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              {subtitleLabel || `当前序列：${displayTickerLabel} | 基准：${benchmarkName}`}
            </div>
          </div>
        </div>
      </div>
      <div className="relative px-3 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#A9B6CC]">
          <button
            type="button"
            onClick={() => setShowPriceLine((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
              showPriceLine ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#F4D35E]" />
            价格线
          </button>
          <button
            type="button"
            onClick={() => setShowSma20((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
              showSma20 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
            SMA20
          </button>
          <button
            type="button"
            onClick={() => setShowSma60((value) => !value)}
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
            onClick={() => setShowSma250((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
              showSma250 ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
            SMA250
          </button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <button
            type="button"
            onClick={() => setShowScorePane((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
              showScorePane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#60A5FA]" />
            RPS Score
          </button>
          <button
            type="button"
            onClick={() => setShowRelativePane((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
              showRelativePane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#F8FAFC]" />
            RPS起点归一
          </button>
          <button
            type="button"
            onClick={() => setShowRsiPane((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-2 py-1 transition',
              showRsiPane ? 'border-white/15 bg-white/5 text-[#E6EDF7]' : 'border-white/10 bg-transparent hover:border-white/15',
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#B9A3FF]" />
            RSI(14)
          </button>
        </div>
        {hoverPoint ? (
          <div className="pointer-events-none absolute right-3 top-12 z-30 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
            <div className="font-mono text-[11px] text-[#A9B6CC]">{hoverPoint.date}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              {showPriceLine ? (
                <>
                  <div className="text-[#A9B6CC]">前复权价格</div>
                  <div className="text-right font-mono">{formatValue(hoverPoint.targetCloseQfq, 4)}</div>
                </>
              ) : null}
              {showSma20 ? (
                <>
                  <div className="text-[#A9B6CC]">SMA20</div>
                  <div className="text-right font-mono">{formatValue(hoverPoint.sma20, 4)}</div>
                </>
              ) : null}
              {showSma60 ? (
                <>
                  <div className="text-[#A9B6CC]">SMA60</div>
                  <div className="text-right font-mono">{formatValue(hoverPoint.sma60, 4)}</div>
                </>
              ) : null}
              {showSma250 ? (
                <>
                  <div className="text-[#A9B6CC]">SMA250</div>
                  <div className="text-right font-mono">{formatValue(hoverPoint.sma250, 4)}</div>
                </>
              ) : null}
              {showScorePane ? (
                <>
                  <div className="text-[#A9B6CC]">RPS Score</div>
                  <div className="text-right font-mono">{formatValue(hoverPoint.scorePct, 2)}</div>
                </>
              ) : null}
              <div className="text-[#A9B6CC]">放量倍数</div>
              <div className="text-right font-mono">{formatValue(hoverPoint.turnoverMultipleOfPrev20Avg, 2)}x</div>
              {showRelativePane ? (
                <>
                  <div className="text-[#A9B6CC]">RPS起点归一</div>
                  <div className="text-right font-mono">{formatValue(hoverRelativeValue, 4)}</div>
                  <div className="text-[#A9B6CC]">RPS MA50起点归一</div>
                  <div className="text-right font-mono">{formatValue(hoverRelativeMa50Value, 4)}</div>
                </>
              ) : null}
              {showRsiPane ? (
                <>
                  <div className="text-[#A9B6CC]">RSI(14)</div>
                  <div className="text-right font-mono">{formatValue(hoverRsiValue, 2)}</div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className={CHART_PANEL_CLS}>
            <div className={CHART_BADGE_CLS}>
              前复权价格（主图）
              {showPriceLine ? ' + 价格线' : ''}
              {showSma20 ? ' + SMA20' : ''}
              {showSma60 ? ' + SMA60' : ''}
              {showSma250 ? ' + SMA250' : ''} | 绿=Score&lt;0 黄=0~10 橙=10~20 红=&gt;20 柔紫点=成交额&gt;=1.50x
            </div>
            <div ref={priceHostRef} className="h-[300px] w-full" />
          </div>

          <div
            className={cn(
              `${CHART_PANEL_CLS} transition-[height,opacity]`,
              showScorePane ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            style={{ height: showScorePane ? 164 : 1 }}
          >
            <div className={CHART_BADGE_CLS}>RPS Score（副图）</div>
            <div ref={scoreHostRef} className="h-[140px] w-full" />
          </div>

          <div
            className={cn(
              `${CHART_PANEL_CLS} transition-[height,opacity]`,
              showRelativePane ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            style={{ height: showRelativePane ? 164 : 1 }}
          >
            <div className={CHART_BADGE_CLS}>RPS起点归一（副图） + MA50</div>
            <div ref={relativeHostRef} className="h-[140px] w-full" />
          </div>

          <div
            className={cn(
              `${CHART_PANEL_CLS} transition-[height,opacity]`,
              showRsiPane ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            style={{ height: showRsiPane ? 164 : 1 }}
          >
            <div className={CHART_BADGE_CLS}>RSI(14)（副图） | 红区=&gt;70 绿区=&lt;30</div>
            <div ref={rsiHostRef} className="h-[140px] w-full" />
          </div>
        </div>
      </div>
    </section>
  )
}
