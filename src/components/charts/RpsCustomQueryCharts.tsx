import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ColorType, CrosshairMode, LineSeries, createChart, type IChartApi, type ISeriesApi, type LineData, type LogicalRange, type Time, type UTCTimestamp } from 'lightweight-charts'
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
  scorePct: number | null
}

const LINE_COLOR = '#60A5FA'

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

function resolveBaseIndex(range: LogicalRange | null | undefined, length: number): number {
  if (!hasValidLogicalRange(range) || length <= 0) return 0
  const from = Math.max(0, Math.min(length - 1, Math.ceil(Number(range.from))))
  return Number.isFinite(from) ? from : 0
}

function buildRelativeData(points: PreparedPoint[], range: LogicalRange | null | undefined): LineData<Time>[] {
  if (!points.length) return []
  let baseIndex = resolveBaseIndex(range, points.length)
  while (baseIndex < points.length && (!Number.isFinite(points[baseIndex]?.rpsRaw) || points[baseIndex].rpsRaw === 0)) {
    baseIndex += 1
  }
  const base = points[baseIndex]?.rpsRaw
  if (typeof base !== 'number' || !Number.isFinite(base) || base === 0) return []
  const output: LineData<Time>[] = []
  for (const point of points) {
    const value = point.rpsRaw / base
    if (!Number.isFinite(value)) continue
    output.push({ time: point.time, value })
  }
  return output
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
      borderColor: 'rgba(255,255,255,0.10)',
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.10)',
      rightOffset: 0,
      minBarSpacing: 0.6,
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
  data: LineData<Time>[],
  opts?: { baselinePrice?: number; digits?: number },
) {
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const didFitRef = useRef(false)
  const baselineCreatedRef = useRef(false)
  const latestValue = useMemo(() => {
    const last = data[data.length - 1]
    return typeof last?.value === 'number' ? last.value : null
  }, [data])

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
    chartRef.current = chart
    seriesRef.current = series
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [hostRef])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    series.setData(data)
    if (!didFitRef.current && data.length > 0) {
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
  }, [data, opts?.baselinePrice])

  return {
    chartRef,
    seriesRef,
    latestValue: formatValue(latestValue, opts?.digits ?? 4),
  }
}

export default function RpsCustomQueryCharts({ ticker, tickerName, benchmarkName, series }: Props) {
  const priceHostRef = useRef<HTMLDivElement | null>(null)
  const scoreHostRef = useRef<HTMLDivElement | null>(null)
  const relativeHostRef = useRef<HTMLDivElement | null>(null)
  const syncingRangeRef = useRef(false)
  const syncingCrosshairRef = useRef(false)
  const relativeRangeRef = useRef<LogicalRange | null>(null)
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
          scorePct: point.scorePct,
        }
      })
      .filter((point): point is PreparedPoint => Boolean(point))
  }, [series])

  const priceData = useMemo<LineData<Time>[]>(() => {
    return prepared.map((point) => ({ time: point.time, value: point.targetCloseQfq }))
  }, [prepared])
  const scoreData = useMemo<LineData<Time>[]>(() => {
    const output: LineData<Time>[] = []
    for (const point of prepared) {
      if (typeof point.scorePct !== 'number' || !Number.isFinite(point.scorePct)) continue
      output.push({ time: point.time, value: point.scorePct })
    }
    return output
  }, [prepared])
  const [relativeData, setRelativeData] = useState<LineData<Time>[]>([])

  const hoverPointMap = useMemo(() => {
    const map = new Map<UTCTimestamp, PreparedPoint>()
    for (const point of prepared) map.set(point.time, point)
    return map
  }, [prepared])
  const relativeValueMap = useMemo(() => {
    const map = new Map<UTCTimestamp, number>()
    for (const point of relativeData) {
      if (typeof point.time !== 'number' || typeof point.value !== 'number' || !Number.isFinite(point.value)) continue
      map.set(point.time as UTCTimestamp, point.value)
    }
    return map
  }, [relativeData])
  const hoverPoint = hoverTime ? hoverPointMap.get(hoverTime) ?? null : null
  const hoverRelativeValue = hoverTime ? relativeValueMap.get(hoverTime) ?? null : null

  const priceChart = useSingleLineChart(priceHostRef, priceData, { digits: 4 })
  const scoreChart = useSingleLineChart(scoreHostRef, scoreData, { baselinePrice: 0, digits: 2 })
  const relativeChart = useSingleLineChart(relativeHostRef, relativeData, { baselinePrice: 1, digits: 4 })

  useEffect(() => {
    const nextRelative = buildRelativeData(prepared, relativeRangeRef.current)
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
        relativeRangeRef.current = range
        setRelativeData(buildRelativeData(prepared, range))
        charts.forEach((other, otherIndex) => {
          if (otherIndex !== index) safeSetVisibleLogicalRange(other, range)
        })
        syncingRangeRef.current = false
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
    const master = priceChart.chartRef.current
    if (!master || !prepared.length) return
    const initialRange = master.timeScale().getVisibleLogicalRange()
    relativeRangeRef.current = initialRange
    setRelativeData(buildRelativeData(prepared, initialRange))
    if (hasValidLogicalRange(initialRange)) {
      safeSetVisibleLogicalRange(scoreChart.chartRef.current, initialRange)
      safeSetVisibleLogicalRange(relativeChart.chartRef.current, initialRange)
    }
  }, [prepared, priceChart.chartRef, scoreChart.chartRef, relativeChart.chartRef])

  useEffect(() => {
    setHoverTime(null)
  }, [ticker, prepared])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94A3B8]">
          <span className="font-mono text-[#E6EDF7]">
            {ticker}
            {tickerName ? `（${tickerName}）` : ''}
          </span>
          <span>三图共享日期范围、十字光标与 hover 日期。</span>
          <span>RPS起点归一视图按当前可见区间最左侧交易日动态归一。</span>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[#CBD5E1]">
          {hoverPoint ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-mono text-[#E6EDF7]">{hoverPoint.date}</span>
              <span>价格 {formatValue(hoverPoint.targetCloseQfq, 4)}</span>
              <span>Score {formatValue(hoverPoint.scorePct, 2)}</span>
              <span>起点归一 {formatValue(hoverRelativeValue, 4)}</span>
            </div>
          ) : (
            <span>悬停任一图表可查看三图同日数据。</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-[#0B1220] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#F8FAFC]">前复权价格走势图</div>
            <div className="text-xs font-mono text-[#94A3B8]">最新值 {priceChart.latestValue}</div>
          </div>
          <div ref={priceHostRef} className="h-[280px] w-full rounded-lg border border-white/10 bg-[#111B2E]" />
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0B1220] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#F8FAFC]">MA50归一视图（Score走势）</div>
            <div className="text-xs font-mono text-[#94A3B8]">最新值 {scoreChart.latestValue}</div>
          </div>
          <div className="mb-2 text-xs text-[#64748B]">口径：{ticker} 相对于 {benchmarkName} 的 `Score=((RPS/MA50)-1)*100%`。</div>
          <div ref={scoreHostRef} className="h-[220px] w-full rounded-lg border border-white/10 bg-[#111B2E]" />
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0B1220] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#F8FAFC]">RPS起点归一视图</div>
            <div className="text-xs font-mono text-[#94A3B8]">最新值 {relativeChart.latestValue}</div>
          </div>
          <div className="mb-2 text-xs text-[#64748B]">口径：当前可见区间最左侧交易日的 RPS 归一为 `1.0000`。</div>
          <div ref={relativeHostRef} className="h-[220px] w-full rounded-lg border border-white/10 bg-[#111B2E]" />
        </div>
      </div>
    </div>
  )
}
