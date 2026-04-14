import { useMemo } from 'react'
import LowVolOpportunityChart from '@/components/charts/LowVolOpportunityChart'
import type { LowVolH30269Point, ValueTimingPoint } from '@/utils/marketApi'

type Props = {
  series: ValueTimingPoint[]
  indexCode?: string
  biasBasis: 'sma250' | 'sma60'
  className?: string
}

export default function ValueTimingChart({ series, indexCode, biasBasis, className }: Props) {
  const mapped = useMemo<LowVolH30269Point[]>(
    () =>
      (Array.isArray(series) ? series : []).map((p) => ({
        date: p.date,
        close: p.close,
        ma60: p.ma60 ?? null,
        ma250: p.ma250 ?? null,
        bias60: p.bias60 ?? null,
        bias250: p.bias250 ?? null,
        biasPct3y60: p.biasPct3y60 ?? null,
        biasPct3y: p.biasPct3y ?? null,
        dividendYieldPct: p.earningsYieldPct ?? null,
        yield10yPct: p.yield10yPct ?? null,
        spreadRawPct: p.spreadPct ?? null,
        spreadSmoothPct: p.spreadPct ?? null,
        spreadPct: p.spreadPct ?? null,
        spreadPctRank3y: null,
        spreadPctRank10y: p.spreadPctRank5y ?? null,
      })),
    [series],
  )

  return <LowVolOpportunityChart series={mapped} indexCode={indexCode} biasBasis={biasBasis} metricMode="earnings" className={className} />
}
