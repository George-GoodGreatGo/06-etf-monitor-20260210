import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  BaselineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { RpsStyleSeriesPoint } from '@/utils/marketApi'

type Props = {
  seriesByTicker: Record<string, RpsStyleSeriesPoint[]>
  viewMode: 'raw' | 'relative' | 'score'
  baseLabel?: string
  tickerNameMap?: Record<string, string>
  enabledTickers?: Record<string, boolean>
  lockEdges?: boolean
}

function ymdToUtcSeconds(ymd: string): UTCTimestamp | null {
  const s = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return Math.floor(Date.UTC(y, m - 1, d) / 1000) as UTCTimestamp
}

const COLORS = ['#60A5FA', '#F59E0B', '#34D399', '#F87171'] as const

function normalizeTime(t: Time | undefined): number | null {
  if (t == null) return null
  if (typeof t === 'number') return Number(t)
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const y = Number((t as { year: unknown }).year)
    const m = Number((t as { month: unknown }).month)
    const d = Number((t as { day: unknown }).day)
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
    return Math.floor(Date.UTC(y, m - 1, d) / 1000)
  }
  return null
}

function fmt(v: number | null | undefined, digits = 4): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

type HoverRow = { ticker: string; rps: number | null; ma50: number | null }
type HoverState = { date: string; rows: HoverRow[] }

export default function RpsStyleChart({
  seriesByTicker,
  viewMode,
  baseLabel = '512890.SH=1',
  tickerNameMap = {},
  enabledTickers = {},
  lockEdges = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineRefs = useRef<Array<ISeriesApi<'Line', Time>>>([])
  const bgRefs = useRef<Array<ISeriesApi<'Baseline', Time>>>([])
  const [hover, setHover] = useState<HoverState | null>(null)

  const prepared = useMemo(() => {
    const tickers = Object.keys(seriesByTicker).sort().filter((ticker) => enabledTickers[ticker] !== false)
    const byTime = new Map<number, { date: string; rows: Record<string, { rps: number | null; ma50: number | null }> }>()
    const lines = tickers.map((ticker, idx) => {
      const src = Array.isArray(seriesByTicker[ticker]) ? seriesByTicker[ticker] : []
      const rps: LineData<Time>[] = []
      const ma50: LineData<Time>[] = []
      let startRpsRaw: number | null = null
      for (const p of src) {
        const t = ymdToUtcSeconds(p.date)
        if (!t) continue
        const hit = byTime.get(Number(t)) || { date: p.date, rows: {} }
        const prev = hit.rows[ticker] || { rps: null, ma50: null }
        if (viewMode === 'score') {
          if (typeof p.scorePct === 'number' && Number.isFinite(p.scorePct)) {
            rps.push({ time: t, value: p.scorePct })
            ma50.push({ time: t, value: 0 })
            hit.rows[ticker] = { rps: p.scorePct, ma50: 0 }
            byTime.set(Number(t), hit)
          }
          continue
        }

        if (typeof p.rpsRaw === 'number' && Number.isFinite(p.rpsRaw)) {
          if (startRpsRaw == null && p.rpsRaw !== 0) startRpsRaw = p.rpsRaw
          const rpsVal = viewMode === 'relative' && startRpsRaw != null ? p.rpsRaw / startRpsRaw : p.rpsRaw
          if (Number.isFinite(rpsVal)) {
            rps.push({ time: t, value: rpsVal })
            hit.rows[ticker] = { ...prev, rps: rpsVal }
            byTime.set(Number(t), hit)
          }
        }
        if (typeof p.rpsMa50 === 'number' && Number.isFinite(p.rpsMa50)) {
          if (viewMode === 'relative') {
            if (startRpsRaw != null) {
              const maVal = p.rpsMa50 / startRpsRaw
              if (Number.isFinite(maVal)) {
                ma50.push({ time: t, value: maVal })
                hit.rows[ticker] = { ...(hit.rows[ticker] || prev), ma50: maVal }
                byTime.set(Number(t), hit)
              }
            }
          } else {
            ma50.push({ time: t, value: p.rpsMa50 })
            hit.rows[ticker] = { ...(hit.rows[ticker] || prev), ma50: p.rpsMa50 }
            byTime.set(Number(t), hit)
          }
        }
      }
      rps.sort((a, b) => (a.time as number) - (b.time as number))
      ma50.sort((a, b) => (a.time as number) - (b.time as number))
      return { ticker, color: COLORS[idx % COLORS.length], rps, ma50 }
    })
    let scoreMin = Number.POSITIVE_INFINITY
    let scoreMax = Number.NEGATIVE_INFINITY
    for (const item of lines) {
      for (const p of item.rps) {
        const v = Number(p.value)
        if (!Number.isFinite(v)) continue
        if (v < scoreMin) scoreMin = v
        if (v > scoreMax) scoreMax = v
      }
    }
    return {
      lines,
      byTime,
      scoreRange:
        Number.isFinite(scoreMin) && Number.isFinite(scoreMax)
          ? { min: scoreMin, max: scoreMax }
          : null,
    }
  }, [enabledTickers, seriesByTicker, viewMode])

  const scoreFixedRange = useMemo(() => {
    const min = prepared.scoreRange?.min
    const max = prepared.scoreRange?.max
    if (typeof min === 'number' && Number.isFinite(min) && typeof max === 'number' && Number.isFinite(max)) {
      return {
        minValue: Math.min(-20, min) - 10,
        maxValue: Math.max(20, max) + 10,
      }
    }
    return { minValue: -30, maxValue: 30 }
  }, [prepared.scoreRange?.max, prepared.scoreRange?.min])

  useEffect(() => {
    const el = hostRef.current
    if (!el || chartRef.current) return
    const chart = createChart(el, {
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
        fixLeftEdge: lockEdges,
        fixRightEdge: lockEdges,
        rightOffset: 0,
        minBarSpacing: 0.6,
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: { mouseWheel: true, axisPressedMouseMove: true, pinch: true },
      handleScroll: { mouseWheel: false },
    })
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
      lineRefs.current = []
      bgRefs.current = []
    }
  }, [lockEdges])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.applyOptions({
      handleScale:
        viewMode === 'score'
          ? { mouseWheel: true, axisPressedMouseMove: false, pinch: true }
          : { mouseWheel: true, axisPressedMouseMove: true, pinch: true },
    })
  }, [viewMode])

  function buildScoreBgBands(range: { min: number; max: number }): Array<{ top: number; bottom: number; color: string }> {
    const upper = Math.max(20, range.max) + 10
    const lower = Math.min(-20, range.min) - 10
    return [
      { top: -20, bottom: lower, color: 'rgba(22, 101, 52, 0.18)' }, // < -20
      { top: -10, bottom: -20, color: 'rgba(21, 128, 61, 0.16)' }, // [-20, -10)
      { top: 0, bottom: -10, color: 'rgba(74, 222, 128, 0.14)' }, // [-10, 0]
      { top: 10, bottom: 0, color: 'rgba(250, 204, 21, 0.14)' }, // (0, 10]
      { top: 20, bottom: 10, color: 'rgba(251, 146, 60, 0.14)' }, // (10, 20]
      { top: upper, bottom: 20, color: 'rgba(239, 68, 68, 0.16)' }, // > 20
    ]
      .filter((b) => b.top !== b.bottom)
  }

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    setHover(null)
    for (const s of bgRefs.current) chart.removeSeries(s)
    bgRefs.current = []
    for (const s of lineRefs.current) chart.removeSeries(s)
    lineRefs.current = []

    // Score background bands (behind lines)
    if (viewMode === 'score' && prepared.lines.length > 0) {
      let minTime = Number.POSITIVE_INFINITY
      let maxTime = Number.NEGATIVE_INFINITY
      for (const item of prepared.lines) {
        for (const p of item.rps) {
          const t = Number(p.time)
          if (Number.isFinite(t)) {
            if (t < minTime) minTime = t
            if (t > maxTime) maxTime = t
          }
        }
      }
      if (Number.isFinite(minTime) && Number.isFinite(maxTime) && minTime <= maxTime && prepared.scoreRange) {
        const bands = buildScoreBgBands(prepared.scoreRange)
        for (const b of bands) {
          const top = Math.max(b.top, b.bottom)
          const bottom = Math.min(b.top, b.bottom)
          const s = chart.addSeries(BaselineSeries, {
            baseValue: { type: 'price', price: bottom },
            topLineColor: 'rgba(0,0,0,0)',
            topFillColor1: b.color,
            topFillColor2: b.color,
            bottomLineColor: 'rgba(0,0,0,0)',
            bottomFillColor1: 'rgba(0,0,0,0)',
            bottomFillColor2: 'rgba(0,0,0,0)',
            priceLineVisible: false,
            lastValueVisible: false,
          })
          s.setData([
            { time: minTime as UTCTimestamp, value: top },
            { time: maxTime as UTCTimestamp, value: top },
          ])
          bgRefs.current.push(s)
        }
      }
    }

    for (const item of prepared.lines) {
      const rpsSeries = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        ...(viewMode === 'score'
          ? {
              autoscaleInfoProvider: () => ({
                priceRange: {
                  minValue: scoreFixedRange.minValue,
                  maxValue: scoreFixedRange.maxValue,
                },
              }),
            }
          : {}),
      })
      rpsSeries.setData(item.rps)
      if (viewMode === 'relative') {
        rpsSeries.createPriceLine({
          price: 1,
          color: 'rgba(169,182,204,0.35)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: '',
        })
      } else if (viewMode === 'score') {
        rpsSeries.createPriceLine({
          price: 0,
          color: 'rgba(169,182,204,0.35)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: '',
        })
      }
      lineRefs.current.push(rpsSeries)

      const maSeries = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      maSeries.setData(item.ma50)
      lineRefs.current.push(maSeries)
    }
    if (lockEdges) {
      let minTime = Number.POSITIVE_INFINITY
      let maxTime = Number.NEGATIVE_INFINITY
      for (const item of prepared.lines) {
        for (const p of item.rps) {
          const t = Number(p.time)
          if (Number.isFinite(t)) {
            if (t < minTime) minTime = t
            if (t > maxTime) maxTime = t
          }
        }
        for (const p of item.ma50) {
          const t = Number(p.time)
          if (Number.isFinite(t)) {
            if (t < minTime) minTime = t
            if (t > maxTime) maxTime = t
          }
        }
      }
      if (Number.isFinite(minTime) && Number.isFinite(maxTime) && minTime <= maxTime) {
        if (viewMode === 'score') {
          const twoYearsSec = 730 * 24 * 60 * 60
          const from = Math.max(minTime, maxTime - twoYearsSec)
          chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: maxTime as UTCTimestamp })
        } else {
          chart.timeScale().setVisibleRange({ from: minTime as UTCTimestamp, to: maxTime as UTCTimestamp })
        }
      }
    } else {
      chart.timeScale().fitContent()
    }
  }, [lockEdges, prepared, viewMode])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const onMove = (param: { time?: Time } | null) => {
      const t = normalizeTime(param?.time)
      if (!t) {
        setHover(null)
        return
      }
      const hit = prepared.byTime.get(t)
      if (!hit) {
        setHover(null)
        return
      }
      const rows = Object.keys(hit.rows)
        .sort()
        .map((ticker) => ({ ticker, rps: hit.rows[ticker]?.rps ?? null, ma50: hit.rows[ticker]?.ma50 ?? null }))
      setHover({ date: hit.date, rows })
    }
    chart.subscribeCrosshairMove(onMove)
    return () => chart.unsubscribeCrosshairMove(onMove)
  }, [prepared])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A9B6CC]">
        {prepared.lines.map((x) => (
          <div key={x.ticker} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: x.color }} />
            <span className="font-mono">
              {x.ticker}
              {tickerNameMap[x.ticker] ? `（${tickerNameMap[x.ticker]}）` : ''}
            </span>
            <span className="text-[#64748B]">
              {viewMode === 'relative'
                ? '归一化RPS 实线 / 归一化MA50 虚线'
                : viewMode === 'score'
                  ? 'Score 实线 / MA50归一基线(0) 虚线'
                  : 'RPS 实线 / MA50 虚线'}
            </span>
          </div>
        ))}
        {viewMode === 'relative' ? <div className="text-[#64748B]">参考线：{baseLabel}</div> : null}
        {viewMode === 'score' ? <div className="text-[#64748B]">参考线：Y=0（MA50归一基线）</div> : null}
        {viewMode === 'score' ? <div className="text-[#64748B]">阈值：&lt;-20 深绿 | -20~-10 绿 | -10~0 浅绿 | 0~10 黄 | 10~20 橙 | &gt;20 红</div> : null}
      </div>
      <div className="relative">
        {prepared.lines.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-white/10 bg-black/25 text-sm text-[#A9B6CC]">
            请至少选择一个指数
          </div>
        ) : null}
        {hover ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-[#E6EDF7] backdrop-blur">
            <div className="font-mono text-[11px] text-[#A9B6CC]">{hover.date}</div>
            <div className="mt-1 space-y-1">
              {hover.rows.map((r) => (
                <div key={r.ticker} className="grid grid-cols-[150px_110px_110px] items-center gap-2">
                  <div className="font-mono text-[#CBD5E1]">
                    {r.ticker}
                    {tickerNameMap[r.ticker] ? `（${tickerNameMap[r.ticker]}）` : ''}
                  </div>
                  <div className="text-right font-mono">{viewMode === 'score' ? `Score ${fmt(r.rps, 4)}` : `RPS ${fmt(r.rps, 4)}`}</div>
                  <div className="text-right font-mono">{viewMode === 'score' ? `基线 ${fmt(r.ma50, 4)}` : `MA50 ${fmt(r.ma50, 4)}`}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div ref={hostRef} className="h-[540px] w-full rounded-lg border border-white/10 bg-[#111B2E]" />
      </div>
    </div>
  )
}
