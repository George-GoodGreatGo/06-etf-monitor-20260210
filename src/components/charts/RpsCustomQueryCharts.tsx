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
const PANEL_CLS = 'overflow-hidden rounded-md bg-[#0E1627]'
const PANEL_HEADER_CLS = 'px-3 py-2.5'
const PANEL_BODY_CLS = 'px-3 pb-2.5'
const CHART_HOST_CLS = 'w-full rounded-md bg-[#111B2E]'
const AXIS_BORDER_COLOR = 'rgba(255,255,255,0.05)'

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

function resolveScoreTone(score: number | null | undefined): { label: string; cls: string } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { label: '暂无判定', cls: 'text-[#94A3B8]' }
  if (score > 0) return { label: '强于MA50', cls: 'text-[#34D399]' }
  if (score < 0) return { label: '弱于MA50', cls: 'text-[#F87171]' }
  return { label: '贴近MA50', cls: 'text-[#E6EDF7]' }
}

function resolveRelativeTone(value: number | null | undefined): { label: string; cls: string } {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { label: '暂无判定', cls: 'text-[#94A3B8]' }
  if (value > 1) return { label: '高于起点', cls: 'text-[#34D399]' }
  if (value < 1) return { label: '低于起点', cls: 'text-[#F87171]' }
  return { label: '贴近起点', cls: 'text-[#E6EDF7]' }
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

function createBaseChart(host: HTMLDivElement): IChartApi {
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
    },
    timeScale: {
      borderColor: AXIS_BORDER_COLOR,
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
    const chart = createBaseChart(host)
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
  }, [hostRef])

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
  const latestPoint = prepared[prepared.length - 1] ?? null
  const latestRelativeValue = useMemo(() => {
    for (let i = relativeData.rps.length - 1; i >= 0; i -= 1) {
      const point = relativeData.rps[i] as { value?: unknown }
      if (typeof point?.value === 'number' && Number.isFinite(point.value)) return point.value
    }
    return null
  }, [relativeData])
  const scoreTone = resolveScoreTone(hoverPoint?.scorePct ?? latestPoint?.scorePct)
  const relativeTone = resolveRelativeTone(hoverRelativeValue ?? latestRelativeValue)

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
        syncingRangeRef.current = true
        visibleRangeRef.current = range
        setRelativeData(buildRelativeData(prepared, range))
        try {
          charts.forEach((other, otherIndex) => {
            if (otherIndex !== index) safeSetVisibleLogicalRange(other, range)
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
    if (!hasValidLogicalRange(range)) return
    syncingRangeRef.current = true
    try {
      safeSetVisibleLogicalRange(priceChart.chartRef.current, range)
      safeSetVisibleLogicalRange(scoreChart.chartRef.current, range)
      safeSetVisibleLogicalRange(relativeChart.chartRef.current, range)
    } finally {
      syncingRangeRef.current = false
    }
  }, [relativeData, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef])

  useEffect(() => {
    const master = priceChart.chartRef.current
    if (!master || !prepared.length) return
    const initialRange = master.timeScale().getVisibleLogicalRange()
    visibleRangeRef.current = initialRange
    setRelativeData(buildRelativeData(prepared, initialRange))
    if (hasValidLogicalRange(initialRange)) {
      safeSetVisibleLogicalRange(scoreChart.chartRef.current, initialRange)
      safeSetVisibleLogicalRange(relativeChart.chartRef.current, initialRange)
    }
  }, [prepared, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef])

  useEffect(() => {
    setHoverTime(null)
    visibleRangeRef.current = null
  }, [ticker, prepared])

  return (
    <div className="space-y-3">
      <section className={PANEL_CLS}>
        <div className={`${PANEL_HEADER_CLS} flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between`}>
          <div>
            <div className="text-base font-semibold tracking-tight text-white">三图联动</div>
            <div className="mt-1 space-y-0.5 text-xs leading-relaxed text-[#94A3B8]">
              <p>
                <span className="font-medium text-[#CBD5E1]">共享交互</span>：hover 日期、十字光标、范围与 X 轴严格对齐。
              </p>
              <p>
                <span className="font-medium text-[#CBD5E1]">新增表达</span>：Score 背景阈值区间与起点归一 MA50 虚线已对齐总览页。
              </p>
            </div>
          </div>

          <div className="min-w-[260px] rounded-md bg-[#0B1220] px-3 py-2 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[#94A3B8]">当前日期</div>
              <div className="font-mono text-[11px] text-[#E6EDF7]">{hoverPoint?.date ?? latestPoint?.date ?? '—'}</div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">前复权价格</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">
                  {formatValue(hoverPoint?.targetCloseQfq ?? latestPoint?.targetCloseQfq, 4)}
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">RPS Score</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-mono text-sm font-semibold text-[#F8FAFC]">
                    {formatValue(hoverPoint?.scorePct ?? latestPoint?.scorePct, 2)}
                  </div>
                  <div className={`text-xs font-medium ${scoreTone.cls}`}>{scoreTone.label}</div>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">起点归一RPS</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-mono text-sm font-semibold text-[#F8FAFC]">
                    {formatValue(hoverRelativeValue ?? latestRelativeValue, 4)}
                  </div>
                  <div className={`text-xs font-medium ${relativeTone.cls}`}>{relativeTone.label}</div>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-[#94A3B8]">起点归一MA50</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{formatValue(hoverRelativeMa50Value, 4)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${PANEL_BODY_CLS} flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#94A3B8]`}>
          <span className="font-mono text-[#E6EDF7]">
            {ticker}
            {tickerName ? `（${tickerName}）` : ''}
          </span>
          <span>分母基准：{benchmarkName}</span>
          <span>悬停任一图表可查看三图同日数据。</span>
        </div>
      </section>

      <section className={PANEL_CLS}>
        <div className={`${PANEL_HEADER_CLS} flex flex-col gap-0.5 lg:flex-row lg:items-end lg:justify-between`}>
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">前复权价格走势图</div>
            <div className="text-[11px] leading-relaxed text-[#94A3B8]">
              观察标的价格本体走势，作为 Score 与 RPS 相对变化的原始参照。
            </div>
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8]">最新值 {priceChart.latestValue}</div>
        </div>
        <div className={PANEL_BODY_CLS}>
          <div ref={priceHostRef} className={`h-[230px] ${CHART_HOST_CLS}`} />
        </div>
      </section>

      <section className={PANEL_CLS}>
        <div className={`${PANEL_HEADER_CLS} flex flex-col gap-0.5 lg:flex-row lg:items-end lg:justify-between`}>
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">MA50归一视图（Score走势）</div>
            <div className="text-[11px] leading-relaxed text-[#94A3B8]">
              口径：{ticker} 相对于 {benchmarkName} 的 `Score=((RPS/MA50)-1)*100%`，用于衡量相对强弱偏离程度。
            </div>
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8]">最新值 {scoreChart.latestValue}</div>
        </div>
        <div className={PANEL_BODY_CLS}>
          <div ref={scoreHostRef} className={`h-[170px] ${CHART_HOST_CLS}`} />
        </div>
      </section>

      <section className={PANEL_CLS}>
        <div className={`${PANEL_HEADER_CLS} flex flex-col gap-0.5 lg:flex-row lg:items-end lg:justify-between`}>
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">RPS起点归一视图</div>
            <div className="text-[11px] leading-relaxed text-[#94A3B8]">
              口径：当前可见区间最左侧交易日的 RPS 归一为 `1.0000`，并加入目标 ETF 的 RPS MA50 虚线参照。
            </div>
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8]">最新值 {relativeChart.latestValue}</div>
        </div>
        <div className={PANEL_BODY_CLS}>
          <div ref={relativeHostRef} className={`h-[170px] ${CHART_HOST_CLS}`} />
        </div>
      </section>
    </div>
  )
}
