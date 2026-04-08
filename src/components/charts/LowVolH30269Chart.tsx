import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorType, CrosshairMode, LineSeries, createChart, type IChartApi, type ISeriesApi, type LineData, type Time, type UTCTimestamp } from 'lightweight-charts'
import { cn } from '@/lib/utils'
import type { LowVolH30269Point } from '@/utils/marketApi'

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

type ViewKey = 'close' | 'bias' | 'biasPct' | 'spread' | 'spreadPct'

type Props = {
  series: LowVolH30269Point[]
  view: ViewKey
  className?: string
}

type Hover = { date: string; t: UTCTimestamp; v?: number; v2?: number }

export default function LowVolH30269Chart({ series, view, className }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const s1Ref = useRef<ISeriesApi<'Line', Time> | null>(null)
  const s2Ref = useRef<ISeriesApi<'Line', Time> | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  const data = useMemo(() => {
    const a: LineData<Time>[] = []
    const b: LineData<Time>[] = []
    const map = new Map<UTCTimestamp, Hover>()

    for (const p of series) {
      const t = ymdToUtcSeconds(p.date)
      if (!t) continue
      let v: number | null = null
      let v2: number | null = null
      if (view === 'close') {
        v = p.close
        v2 = p.ma250
      } else if (view === 'bias') {
        v = p.bias250
      } else if (view === 'biasPct') {
        v = p.biasPct3y
      } else if (view === 'spread') {
        v = p.spreadSmoothPct
      } else if (view === 'spreadPct') {
        v = p.spreadPctRank10y
      }
      if (typeof v === 'number' && Number.isFinite(v)) a.push({ time: t, value: v })
      if (typeof v2 === 'number' && Number.isFinite(v2)) b.push({ time: t, value: v2 })
      map.set(t, { date: p.date, t, v: v == null ? undefined : v, v2: v2 == null ? undefined : v2 })
    }

    return { a, b, map }
  }, [series, view])

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    if (chartRef.current) return

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' }, textColor: '#E5E7EB' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)' },
    })

    const s1 = chart.addSeries(LineSeries, { color: '#60A5FA', lineWidth: 2 })
    const s2 = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.55)', lineWidth: 1 })

    chart.subscribeCrosshairMove((param) => {
      const t = normalizeTime(param.time)
      if (!t) {
        setHover(null)
        return
      }
      const h = data.map.get(t)
      setHover(h ?? null)
    })

    chartRef.current = chart
    s1Ref.current = s1
    s2Ref.current = s2

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      s1Ref.current = null
      s2Ref.current = null
    }
  }, [data.map])

  useEffect(() => {
    const s1 = s1Ref.current
    const s2 = s2Ref.current
    if (!s1 || !s2) return
    s1.setData(data.a)
    s2.setData(view === 'close' ? data.b : [])
    if (chartRef.current) chartRef.current.timeScale().fitContent()
  }, [data, view])

  const title =
    view === 'close'
      ? '指数点位'
      : view === 'bias'
        ? 'BIAS(250)'
        : view === 'biasPct'
          ? 'BIAS分位(3年)'
          : view === 'spread'
            ? '利差（平滑）'
            : '利差分位(10年)'

  const unit =
    view === 'close'
      ? '点'
      : view === 'bias'
        ? ''
        : view === 'biasPct'
          ? '%'
          : view === 'spread'
            ? '%'
            : '%'

  return (
    <div className={cn('relative overflow-hidden rounded border border-white/10 bg-[rgba(255,255,255,0.02)]', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="text-xs text-[#9CA3AF]">
          {hover ? hover.date : '—'} · {fmt(hover?.v ?? null, view === 'close' ? 2 : 4)}
          {unit ? ` ${unit}` : ''}
          {view === 'close' ? ` · MA250 ${fmt(hover?.v2 ?? null, 2)}` : ''}
        </div>
      </div>
      <div ref={elRef} className="h-[360px] w-full" />
    </div>
  )
}

