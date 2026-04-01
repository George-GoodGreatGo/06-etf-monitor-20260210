import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { EquityBondPoint, LiquidityV5Point } from '@/utils/marketApi'

type Props = {
  series: LiquidityV5Point[]
  equityBond?: EquityBondPoint[]
  className?: string
}

function fmt(v: number | null | undefined, digits: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

type Boll = { mid: number | null; upper: number | null; lower: number | null; bandwidth: number | null }

function buildEmaByDate(points: Array<{ date: string; close: number }>, period: number): Map<string, number> {
  const out = new Map<string, number>()
  if (!points.length) return out
  const a = 2 / (period + 1)
  let prev: number | null = null
  for (const p of points) {
    const v = typeof p.close === 'number' && Number.isFinite(p.close) ? p.close : null
    if (v == null) continue
    prev = prev == null ? v : a * v + (1 - a) * prev
    out.set(p.date, prev)
  }
  return out
}

function buildBoll120ByDate(points: Array<{ date: string; close: number }>, period = 120, k = 2.0): Map<string, Boll> {
  const out = new Map<string, Boll>()
  if (!points.length) return out

  const window: number[] = []
  let sum = 0
  let sumSq = 0

  for (const p of points) {
    const v = typeof p.close === 'number' && Number.isFinite(p.close) ? p.close : null
    if (v == null) {
      window.length = 0
      sum = 0
      sumSq = 0
      out.set(p.date, { mid: null, upper: null, lower: null, bandwidth: null })
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
      out.set(p.date, { mid: null, upper: null, lower: null, bandwidth: null })
      continue
    }

    const mb = sum / period
    const numerator = sumSq - (sum * sum) / period
    const variance = numerator <= 0 ? 0 : numerator / (period - 1)
    const std = Math.sqrt(variance)
    const ub = mb + k * std
    const lb = mb - k * std
    const bw = mb === 0 ? null : (ub - lb) / mb
    out.set(p.date, { mid: mb, upper: ub, lower: lb, bandwidth: bw })
  }

  return out
}

export default function MarketLiquidityTable({ series, equityBond, className }: Props) {
  const [limit, setLimit] = useState<number>(720)

  const derivedByDate = useMemo(() => {
    const src = series || []
    const base = src
      .map((p) => ({ date: String(p?.date || '').trim(), close: p?.close }))
      .filter((p): p is { date: string; close: number } => !!p.date && typeof p.close === 'number' && Number.isFinite(p.close))

    return {
      ema20: buildEmaByDate(base, 20),
      ema60: buildEmaByDate(base, 60),
      boll: buildBoll120ByDate(base, 120, 2.0),
    }
  }, [series])

  const rows = useMemo(() => {
    const ebByDate = new Map<string, EquityBondPoint>()
    for (const p of equityBond || []) {
      const d = String(p?.date || '').trim()
      if (!d) continue
      ebByDate.set(d, p)
    }

    const src = series || []
    if (limit <= 0 || src.length <= limit) {
      return src.map((p) => ({ p, eb: ebByDate.get(p.date) ?? null })).reverse()
    }
    const sliced = src.slice(Math.max(0, src.length - limit))
    return sliced.map((p) => ({ p, eb: ebByDate.get(p.date) ?? null })).reverse()
  }, [equityBond, limit, series])

  return (
    <div className={cn('rounded-lg border border-white/10 bg-[#111B2E]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs text-[#A9B6CC]">
        <div className="font-medium text-[#E6EDF7]">表格视图</div>
        <div className="flex items-center gap-2">
          <div className="text-[#94A3B8]">展示范围</div>
          <select
            className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#E6EDF7]"
            value={String(limit)}
            onChange={(e) => {
              const v = Number(e.target.value)
              setLimit(Number.isFinite(v) ? v : 720)
            }}
          >
            <option value="90">最近 90 日</option>
            <option value="180">最近 180 日</option>
            <option value="360">最近 360 日</option>
            <option value="720">最近 720 日</option>
            <option value="0">全部</option>
          </select>
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[1480px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#0F172A]">
            <tr className="text-[#94A3B8]">
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-left font-medium">日期</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">沪深300(点)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">EMA20(点)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">EMA60(点)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">BOLL120(MB,点)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">BOLL120(UB,点)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">BOLL120(LB,点)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">BOLL120(BW)</th>

              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">成交额(沪+深,千元)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">成交额分位(%)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">换手率(均,%)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">换手率分位(%)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">北向资金(万元)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">北向分位(%)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">流动性指数(无量纲)</th>

              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">PE(倍)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">1/PE(比率)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">10Y(%)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">股债利差(比率)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">股债分位(%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, eb }) => {
              const ema20 = derivedByDate.ema20.get(p.date)
              const ema60 = derivedByDate.ema60.get(p.date)
              const bb = derivedByDate.boll.get(p.date)
              return (
              <tr key={p.date} className="border-b border-white/5 text-[#E6EDF7]">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[#A9B6CC]">{p.date}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.close, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(ema20, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(ema60, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(bb?.mid, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(bb?.upper, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(bb?.lower, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(bb?.bandwidth, 4)}</td>

                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.amount, 0)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.amountPct, 1)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.tr, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.trPct, 1)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.northMoney, 0)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.northPct, 1)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.v5, 1)}</td>

                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(eb?.pe, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(eb?.earningsYield, 4)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(eb?.yield10yPct, 2)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(eb?.value, 4)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(eb?.pct, 1)}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
