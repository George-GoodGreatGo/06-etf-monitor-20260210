import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  BaselineSeries,
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
import type { RpsStyleSeriesPoint } from '@/utils/marketApi'
import { hasValidLogicalRange, normalizeTime, safeClearCrosshair, safeSetCrosshair, safeSetVisibleLogicalRange } from '@/components/charts/chartSyncGuards'

type Props = {
  ticker: string
  tickerName?: string
  benchmarkName: string
  series: RpsStyleSeriesPoint[]
}

type PreparedPoint = {
  time: UTCTimestamp
  date: string
  targetCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
}

type ChartDatum = LineData<Time> | { time: Time }
type BackgroundBand = { top: number; bottom: number; color: string }

const LINE_COLOR = '#60A5FA'
const MA_LINE_COLOR = 'rgba(248,250,252,0.62)'
const SCALE_MIN_WIDTH = 110
const PANEL_CLS = 'overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg'
const CHART_PANEL_CLS = 'relative rounded-lg border border-white/10 bg-[#111B2E] pt-6'
const CHART_BADGE_CLS =
  'pointer-events-none absolute left-3 top-2 z-20 rounded bg-black/20 px-2 py-1 text-[11px] font-semibold text-[#94A3B8] backdrop-blur'
const AXIS_BORDER_COLOR = 'rgba(255,255,255,0.05)'
const DEFAULT_WINDOW_BARS = 252

function ymdToUtcSeconds(ymd: string): UTCTimestamp | null {
  const s = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const year = Number(s.slice(0, 4))
  const month = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return Math.floor(Date.UTC(year, month - 1, day) / 1000) as UTCTimestamp
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

function getNumericDatumValue(point: ChartDatum): number | null {
  const value = (point as { value?: unknown }).value
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function useSingleLineChart(
  hostRef: RefObject<HTMLDivElement | null>,
  primaryData: ChartDatum[],
  opts?: {
    overlayData?: ChartDatum[]
    backgroundBands?: BackgroundBand[]
    baselinePrice?: number
    digits?: number
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
      color: LINE_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    const overlaySeries = chart.addSeries(LineSeries, {
      color: MA_LINE_COLOR,
      lineWidth: 1,
      lineStyle: 2,
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
  }, [hostRef, opts?.showTimeScale])

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

export default function RpsCustomQueryCharts({ ticker, tickerName, benchmarkName, series }: Props) {
  const priceHostRef = useRef<HTMLDivElement | null>(null)
  const scoreHostRef = useRef<HTMLDivElement | null>(null)
  const relativeHostRef = useRef<HTMLDivElement | null>(null)
  const syncingRangeRef = useRef(false)
  const syncingCrosshairRef = useRef(false)
  const visibleRangeRef = useRef<LogicalRange | null>(null)
  const [hoverTime, setHoverTime] = useState<UTCTimestamp | null>(null)

  const prepared = useMemo<PreparedPoint[]>(() => {
    return series
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
        }
      })
      .filter((point): point is PreparedPoint => Boolean(point))
  }, [series])

  const priceData = useMemo<ChartDatum[]>(() => {
    return prepared.map((point) => ({ time: point.time, value: point.targetCloseQfq }))
  }, [prepared])
  const scoreData = useMemo<ChartDatum[]>(() => {
    return prepared.map((point) =>
      typeof point.scorePct === 'number' && Number.isFinite(point.scorePct)
        ? { time: point.time, value: point.scorePct }
        : toWhitespacePoint(point.time),
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
  const hoverPoint = hoverTime ? hoverPointMap.get(hoverTime) ?? null : null
  const hoverRelativeValue = hoverTime ? relativeValueMap.get(hoverTime) ?? null : null
  const hoverRelativeMa50Value = hoverTime ? relativeMa50ValueMap.get(hoverTime) ?? null : null
  const priceChart = useSingleLineChart(priceHostRef, priceData, { digits: 4, resetKey: ticker })
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
    showTimeScale: true,
  })

  useEffect(() => {
    const nextRelative = buildRelativeData(prepared, visibleRangeRef.current)
    setRelativeData(nextRelative)
  }, [prepared])

  useEffect(() => {
    const charts = [priceChart.chartRef.current, scoreChart.chartRef.current, relativeChart.chartRef.current].filter(Boolean) as IChartApi[]
    if (charts.length !== 3) return
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
  }, [prepared, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef])

  useEffect(() => {
    const charts = [priceChart.chartRef.current, scoreChart.chartRef.current, relativeChart.chartRef.current].filter(Boolean) as IChartApi[]
    const price = priceChart.chartRef.current
    const score = scoreChart.chartRef.current
    const relative = relativeChart.chartRef.current
    if (charts.length !== 3 || !price || !score || !relative) return

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
              ))
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
  }, [hoverPointMap, priceChart.chartRef, priceChart.seriesRef, relativeChart.chartRef, relativeChart.seriesRef, relativeValueMap, scoreChart.chartRef, scoreChart.seriesRef])

  useEffect(() => {
    const range = visibleRangeRef.current
    const nextRange = clampLogicalRange(range, prepared.length)
    if (!hasValidLogicalRange(nextRange)) return
    syncingRangeRef.current = true
    try {
      visibleRangeRef.current = nextRange
      safeSetVisibleLogicalRange(priceChart.chartRef.current, nextRange)
      safeSetVisibleLogicalRange(scoreChart.chartRef.current, nextRange)
      safeSetVisibleLogicalRange(relativeChart.chartRef.current, nextRange)
    } finally {
      syncingRangeRef.current = false
    }
  }, [prepared.length, relativeData, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef])

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
    } finally {
      syncingRangeRef.current = false
    }
  }, [prepared, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef])

  useEffect(() => {
    setHoverTime(null)
    visibleRangeRef.current = null
  }, [ticker, prepared])

  return (
    <section className={PANEL_CLS}>
      <div className="border-b border-white/8 px-3 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">三联动图表</div>
            <div className="mt-0.5 text-xs leading-relaxed text-[#94A3B8]">
              主图展示前复权价格，两张副图分别展示 RPS Score 与 RPS 起点归一，三图共享 hover、十字光标与可见范围。
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#94A3B8]">
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[#E6EDF7]">
            {ticker}
            {tickerName ? `（${tickerName}）` : ''}
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">分母基准：{benchmarkName}</span>
        </div>
      </div>
      <div className="relative px-3 py-3">
        {hoverPoint ? (
          <div className="pointer-events-none absolute right-3 top-3 z-30 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
            <div className="font-mono text-[11px] text-[#A9B6CC]">{hoverPoint.date}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="text-[#A9B6CC]">前复权价格</div>
              <div className="text-right font-mono">{formatValue(hoverPoint.targetCloseQfq, 4)}</div>
              <div className="text-[#A9B6CC]">RPS Score</div>
              <div className="text-right font-mono">{formatValue(hoverPoint.scorePct, 2)}</div>
              <div className="text-[#A9B6CC]">RPS起点归一</div>
              <div className="text-right font-mono">{formatValue(hoverRelativeValue, 4)}</div>
              <div className="text-[#A9B6CC]">RPS MA50起点归一</div>
              <div className="text-right font-mono">{formatValue(hoverRelativeMa50Value, 4)}</div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className={CHART_PANEL_CLS}>
            <div className={CHART_BADGE_CLS}>前复权价格（主图）</div>
            <div ref={priceHostRef} className="h-[300px] w-full" />
          </div>

          <div className={CHART_PANEL_CLS}>
            <div className={CHART_BADGE_CLS}>RPS Score（副图）</div>
            <div ref={scoreHostRef} className="h-[140px] w-full" />
          </div>

          <div className={CHART_PANEL_CLS}>
            <div className={CHART_BADGE_CLS}>RPS起点归一（副图） + MA50</div>
            <div ref={relativeHostRef} className="h-[140px] w-full" />
          </div>
        </div>
      </div>
    </section>
  )
}
