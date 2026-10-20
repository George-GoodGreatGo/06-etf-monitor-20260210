import CnMarketStylePanel from '@/components/CnMarketStylePanel'
import { buildCnPercentileSeries, CN_STYLE_TARGETS, CN_STYLE_DATA_TARGETS, cnMomentumState, type CnStylePanelData } from '@/utils/cnMarketStyle'

const dates: string[] = []
for (const d = new Date('2022-01-03T00:00:00Z'); d <= new Date('2026-10-19T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10))
}
const seriesByTicker: CnStylePanelData['seriesByTicker'] = {}
const items: CnStylePanelData['items'] = []
CN_STYLE_DATA_TARGETS.forEach(({ ticker }, index) => {
  const history = index === 6 ? dates.slice(-100) : dates
  const raw = history.map((_, i) => 0.001 * Math.exp(i * (index - 4) * 0.00005 + 0.03 * Math.sin(i / (13 + index))))
  const series = buildCnPercentileSeries(history.map((date, i) => {
    const ma = i < 49 ? null : raw.slice(i - 49, i + 1).reduce((s, v) => s + v, 0) / 50
    return { date, ticker, benchmarkTicker: '000300', targetCloseQfq: raw[i] * 3000,
      targetHighQfq: raw[i] * 3100, targetLowQfq: raw[i] * 2900, benchmarkCloseQfq: 3000,
      rpsRaw: raw[i], rpsMa50: ma, scorePct: ma == null ? null : (raw[i] / ma - 1) * 100 }
  }))
  seriesByTicker[ticker] = series
  if (!CN_STYLE_TARGETS.some((target) => target.ticker === ticker)) return
  const last = series[series.length - 1]
  const change = last.scorePct! - series[series.length - 6].scorePct!
  items.push({ ticker, date: last.date, scorePct: last.scorePct, scoreChange5dPp: change,
    relativeReturn20dPct: (last.rpsRaw / series[series.length - 21].rpsRaw - 1) * 100,
    percentile: last.percentile!, historyCount: last.historyCount!, ...cnMomentumState(last.scorePct, change) })
})
items.sort((a, b) => b.scorePct! - a.scorePct!)
const previewData = {
  data: { benchmarkTicker: '000300', dataDate: dates[dates.length - 1], seriesByTicker, items },
  meta: { fetchedAt: '2026-10-19T10:00:00Z', dataDate: dates[dates.length - 1], stale: false, isFallback: false, notes: [] },
}

export default function DevCnMarketStyle() {
  const live = new URLSearchParams(window.location.search).get('live') === '1'
  return <main className="mx-auto max-w-7xl p-4 md:p-8">
    <p className="mb-6 rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">{live
      ? '开发联调页面：通过实际数据接口读取 Supabase 真实快照，不使用合成行情。生产环境不提供此路由。'
      : '开发测试页面：以下全部为合成行情，仅用于交互和布局验证，不是真实市场数据。生产环境不提供此路由。'}</p>
    <CnMarketStylePanel previewData={live ? undefined : previewData} />
  </main>
}
