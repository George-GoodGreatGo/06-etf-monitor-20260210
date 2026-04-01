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

export default function MarketLiquidityTable({ series, equityBond, className }: Props) {
  const [limit, setLimit] = useState<number>(720)

  const rows = useMemo(() => {
    const ebByDate = new Map<string, EquityBondPoint>()
    for (const p of equityBond || []) {
      const d = String(p?.date || '').trim()
      if (!d) continue
      ebByDate.set(d, p)
    }

    const src = series || []
    if (limit <= 0 || src.length <= limit) {
      return src.map((p) => ({ p, eb: ebByDate.get(p.date) ?? null }))
    }
    const sliced = src.slice(Math.max(0, src.length - limit))
    return sliced.map((p) => ({ p, eb: ebByDate.get(p.date) ?? null }))
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
        <table className="w-full min-w-[1180px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#0F172A]">
            <tr className="text-[#94A3B8]">
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-left font-medium">日期</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">沪深300</th>

              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">成交额(沪+深)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">成交额分位</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">换手率(均)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">换手率分位</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">北向资金</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">北向分位</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">流动性指数</th>

              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">PE</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">1/PE</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">10Y(%)</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">股债 value</th>
              <th className="whitespace-nowrap border-b border-white/10 px-3 py-2 text-right font-medium">股债分位</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, eb }) => (
              <tr key={p.date} className="border-b border-white/5 text-[#E6EDF7]">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[#A9B6CC]">{p.date}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{fmt(p.close, 2)}</td>

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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

