export const US_STYLE_BENCHMARK = 'VOO' as const
export const US_STYLE_TARGETS = [
  { ticker: 'VYM', name: '高股息', color: '#60A5FA' },
  { ticker: 'VIG', name: '股息成长', color: '#F59E0B' },
  { ticker: 'VGT', name: '信息科技', color: '#34D399' },
  { ticker: 'SCHD', name: '股息权益', color: '#F87171' },
  { ticker: 'QQQM', name: '纳斯达克100', color: '#A78BFA' },
  { ticker: 'SMH', name: '半导体', color: '#22D3EE' },
] as const

export type UsStylePoint = {
  date: string
  ticker: string
  benchmarkTicker: string
  targetCloseQfq: number
  targetHighQfq: number
  targetLowQfq: number
  benchmarkCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
  percentile?: number | null
  historyCount?: number
  historicalCold?: number | null
  historicalHot?: number | null
}

export function buildUsPercentileSeries(series: UsStylePoint[]): UsStylePoint[] {
  const history: Array<{ date: string; score: number }> = []
  const sortedSeries = [...series].sort((a, b) => a.date.localeCompare(b.date))
  return sortedSeries.map((point) => {
    const cutoff = new Date(`${point.date}T00:00:00Z`)
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5)
    const start = cutoff.toISOString().slice(0, 10)
    while (history.length && history[0].date < start) history.shift()
    const values = history.filter((p) => p.date < point.date).map((p) => p.score).sort((a, b) => a - b)
    const valid = typeof point.scorePct === 'number' && Number.isFinite(point.scorePct)
    const ready = valid && values.length >= 252
    const quantile = (p: number) => {
      const index = (values.length - 1) * p
      const lo = Math.floor(index)
      return values[lo] + (values[Math.ceil(index)] - values[lo]) * (index - lo)
    }
    // Midrank handles ties; assess before inserting today's Score to avoid look-ahead.
    const percentile = ready ? 100 * (values.filter((v) => v < point.scorePct!).length
      + 0.5 * values.filter((v) => v === point.scorePct).length) / values.length : null
    const result = { ...point, percentile, historyCount: values.length,
      historicalCold: ready ? quantile(0.1) : null, historicalHot: ready ? quantile(0.9) : null }
    if (valid) history.push({ date: point.date, score: point.scorePct! })
    return result
  })
}

export type UsStyleItem = {
  ticker: string
  scorePct: number
  scoreChange5dPp: number
  relativeReturn20dPct: number
  trend: 'up' | 'down' | 'flat'
  quadrant: '领先走强' | '领先走弱' | '落后修复' | '落后走弱' | '动量平稳'
}

export type UsStyleSnapshot = {
  version: 1
  benchmarkTicker: 'VOO'
  dataDate: string
  fetchedAt: string
  source: string
  priceBasis: 'dividend-and-split-adjusted'
  seriesByTicker: Record<string, UsStylePoint[]>
  items: UsStyleItem[]
}

export function isCurrentUsStyleSnapshot(snapshot: UsStyleSnapshot): boolean {
  return snapshot.benchmarkTicker === US_STYLE_BENCHMARK
    && !snapshot.items.some((item) => item.ticker === US_STYLE_BENCHMARK)
    && US_STYLE_TARGETS.every(({ ticker }) => snapshot.items.some((item) => item.ticker === ticker)
      && snapshot.seriesByTicker[ticker]?.length > 0
      && snapshot.seriesByTicker[ticker].every((point) => point.benchmarkTicker === US_STYLE_BENCHMARK))
}

export type UsScoreZones = {
  cold: number
  hot: number
  sampleCount: number
  startDate: string
  endDate: string
}

export function computeUsScoreZones(
  seriesByTicker: Record<string, Array<{ date: string; scorePct: number | null }>>,
  dataDate: string,
): UsScoreZones | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataDate)) return null
  const cutoff = new Date(`${dataDate}T00:00:00Z`)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5)
  const start = cutoff.toISOString().slice(0, 10)
  const maps = US_STYLE_TARGETS.map(({ ticker }) => new Map(
    (seriesByTicker[ticker] || [])
      .filter((p) => p.date >= start && p.date < dataDate && typeof p.scorePct === 'number' && Number.isFinite(p.scorePct))
      .map((p) => [p.date, p.scorePct as number]),
  ))
  // Equal-weight ticker/session observations, excluding the latest session being assessed.
  const dates = [...maps[0].keys()].filter((date) => maps.every((map) => map.has(date))).sort()
  if (dates.length < 252) return null
  const values = maps.flatMap((map) => dates.map((date) => map.get(date)!)).sort((a, b) => a - b)
  const quantile = (p: number) => {
    const index = (values.length - 1) * p
    const lo = Math.floor(index)
    return values[lo] + (values[Math.ceil(index)] - values[lo]) * (index - lo)
  }
  const cold = quantile(0.1)
  const hot = quantile(0.9)
  if (cold >= 0 || hot <= 0 || cold >= hot) return null
  return { cold, hot, sampleCount: values.length, startDate: dates[0], endDate: dates[dates.length - 1] }
}
