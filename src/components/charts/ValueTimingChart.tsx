import { useMemo } from 'react'
import LowVolOpportunityChart from '@/components/charts/LowVolOpportunityChart'
import type { LowVolH30269Point, ValueTimingPoint } from '@/utils/marketApi'

type Props = {
  series: ValueTimingPoint[]
  indexCode?: string
  indexLabel?: string
  indexDesc?: string
  biasBasis: 'sma250' | 'sma60'
  className?: string
}

export default function ValueTimingChart({ series, indexCode, indexLabel, indexDesc, biasBasis, className }: Props) {
  const toNullable = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const toDate = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const mapped = useMemo<LowVolH30269Point[]>(
    () =>
      (Array.isArray(series) ? series : []).flatMap((p) => {
        const date = toDate(p.date)
        if (!date) return []
        if (typeof p.close !== 'number' || !Number.isFinite(p.close)) return []
        const spreadPct = toNullable(p.spreadPct)
        return [
          {
            date,
            close: p.close,
            ma60: toNullable(p.ma60),
            ma250: toNullable(p.ma250),
            bias60: toNullable(p.bias60),
            bias250: toNullable(p.bias250),
            biasPct3y60: toNullable(p.biasPct3y60),
            biasPct3y: toNullable(p.biasPct3y),
            dividendYieldPct: toNullable(p.earningsYieldPct),
            yield10yPct: toNullable(p.yield10yPct),
            spreadRawPct: spreadPct,
            spreadSmoothPct: spreadPct,
            spreadPct: spreadPct,
            spreadPctRank3y: null,
            spreadPctRank10y: toNullable(p.spreadPctRank5y),
          },
        ]
      }),
    [series],
  )

  return (
    <LowVolOpportunityChart
      series={mapped}
      indexCode={indexCode}
      indexLabel={indexLabel}
      indexDesc={indexDesc}
      biasBasis={biasBasis}
      metricMode="earnings"
      className={className}
    />
  )
}
