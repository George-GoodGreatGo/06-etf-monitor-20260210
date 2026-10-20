import type { RpsStyleSeriesPoint } from './marketApi.js'
import { buildUsPercentileSeries } from './usMarketStyle.js'

export const CN_STYLE_BENCHMARK = '000300'
export const CN_STYLE_TARGETS = [
  { ticker: '159915.SZ', name: '创业板ETF', color: '#60A5FA' },
  { ticker: '588000.SH', name: '科创50ETF', color: '#F59E0B' },
  { ticker: '513180.SH', name: '恒生科技ETF · 跨市场', color: '#34D399' },
  { ticker: '510300.SH', name: '沪深300ETF', color: '#F87171' },
  { ticker: '512050.SH', name: '中证A500ETF', color: '#22D3EE' },
  { ticker: '560010.SH', name: '中证1000ETF', color: '#FBBF24' },
  { ticker: '159259.SZ', name: '国证成长100ETF', color: '#E879F9' },
  { ticker: '159967.SZ', name: '创成长ETF', color: '#A78BFA' },
  { ticker: '159263.SZ', name: '国证价值100ETF', color: '#FB923C' },
] as const

export const CN_STYLE_CHART_TARGETS = [
  ...CN_STYLE_TARGETS.filter((x) => x.ticker !== '510300.SH'),
  { ticker: '512890.SH', name: '红利低波ETF华泰柏瑞 · 价值参考', color: '#F87171' },
] as const

export const CN_STYLE_DATA_TARGETS = [
  ...CN_STYLE_TARGETS,
  ...CN_STYLE_CHART_TARGETS.filter((x) => !CN_STYLE_TARGETS.some((target) => target.ticker === x.ticker)),
]

export function selectCnChartSeries(series: Record<string, CnStylePoint[]>): Record<string, CnStylePoint[]> {
  return Object.fromEntries(CN_STYLE_CHART_TARGETS.map(({ ticker }) => [ticker, series[ticker] || []]))
}

export type CnStylePoint = RpsStyleSeriesPoint & {
  percentile?: number | null
  historyCount?: number
  historicalCold?: number | null
  historicalHot?: number | null
}
export type CnStyleItem = {
  ticker: string
  date: string
  scorePct: number | null
  scoreChange5dPp: number | null
  relativeReturn20dPct: number | null
  percentile: number | null
  historyCount: number
  trend: 'up' | 'down' | 'flat' | 'unavailable'
  quadrant: string
}
export type CnStylePanelData = {
  benchmarkTicker: string
  dataDate: string
  seriesByTicker: Record<string, CnStylePoint[]>
  items: CnStyleItem[]
}

// Use the same causal, per-instrument five-year midrank definition as the US panel.
export const buildCnPercentileSeries = (series: RpsStyleSeriesPoint[]): CnStylePoint[] =>
  buildUsPercentileSeries(series)

export function cnMomentumState(score: number | null, change: number | null): Pick<CnStyleItem, 'trend' | 'quadrant'> {
  if (score == null || change == null) return { trend: 'unavailable', quadrant: '样本不足 / 行情缺失' }
  // A wider display deadband filters small A-share style fluctuations; not a trading rule.
  const trend = change > 0.2 ? 'up' : change < -0.2 ? 'down' : 'flat'
  return { trend, quadrant: trend === 'flat' ? '动量平稳'
    : score >= 0 ? trend === 'up' ? '领先走强' : '领先走弱'
      : trend === 'up' ? '落后修复' : '落后走弱' }
}
