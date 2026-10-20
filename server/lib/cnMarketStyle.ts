import { buildRpsComputedSeries, getRpsStyleSeries, resolveLatestCompleteTradingDate } from './rpsStyle.js'
import { readMarketBoardMeta, readMarketBoardPointsRange } from './supabaseRest.js'
import {
  CN_STYLE_BENCHMARK, CN_STYLE_TARGETS, buildCnPercentileSeries, cnMomentumState,
  type CnStylePanelData, type CnStylePoint,
} from '../../src/utils/cnMarketStyle.js'

type Price = { date: string; close: number }

export function buildCnStylePanel(
  benchmark: Price[],
  targets: Record<string, Array<Price & { high?: number; low?: number }>>,
  now = new Date(),
): CnStylePanelData {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now)
  const completed = resolveLatestCompleteTradingDate(benchmark.map((p) => p.date).filter((date) => date <= today), now)
  const dates = benchmark.filter((p) => completed && p.date <= completed).sort((a, b) => a.date.localeCompare(b.date))
  if (!dates.length) throw new Error('沪深300指数历史为空')
  if (new Set(dates.map((p) => p.date)).size !== dates.length
    || dates.some((p) => !Number.isFinite(p.close) || p.close <= 0)) throw new Error('沪深300指数行情无效')
  const dataDate = dates[dates.length - 1].date
  const seriesByTicker: Record<string, CnStylePoint[]> = {}
  const items: CnStylePanelData['items'] = []
  for (const { ticker } of CN_STYLE_TARGETS) {
    const prices = targets[ticker] || []
    if (new Set(prices.map((p) => p.date)).size !== prices.length) throw new Error(`重复ETF交易日：${ticker}`)
    const targetMap = new Map(prices.filter((p) => Number.isFinite(p.close) && p.close > 0).map((p) => [p.date, p]))
    const computed: CnStylePoint[] = []
    let segment: typeof prices = []
    const flush = () => {
      computed.push(...buildRpsComputedSeries({
        ticker, benchmarkTicker: CN_STYLE_BENCHMARK, targetSeries: segment, benchmarkSeries: dates, maPeriod: 50,
      }))
      segment = []
    }
    // Do not forward-fill suspensions or compress a missing mainland session into MA50.
    for (const day of dates) {
      const price = targetMap.get(day.date)
      if (price) segment.push(price)
      else if (segment.length) flush()
    }
    flush()
    const series = buildCnPercentileSeries(computed)
    seriesByTicker[ticker] = series
    const byDate = new Map(series.map((p) => [p.date, p]))
    const latest = byDate.get(dataDate)
    const before5 = byDate.get(dates[dates.length - 6]?.date)
    const before20 = byDate.get(dates[dates.length - 21]?.date)
    const scorePct = latest?.scorePct ?? null
    const scoreChange5dPp = scorePct != null && before5?.scorePct != null ? scorePct - before5.scorePct : null
    const relativeReturn20dPct = latest?.scorePct != null && before20
      ? (latest.rpsRaw / before20.rpsRaw - 1) * 100 : null
    items.push({
      ticker, date: dataDate, scorePct, scoreChange5dPp, relativeReturn20dPct,
      percentile: latest?.percentile ?? null, historyCount: latest?.historyCount ?? 0,
      ...cnMomentumState(scorePct, scoreChange5dPp),
    })
  }
  items.sort((a, b) => (b.scorePct ?? -Infinity) - (a.scorePct ?? -Infinity))
  return { benchmarkTicker: CN_STYLE_BENCHMARK, dataDate, seriesByTicker, items }
}

export async function getCnStylePanel() {
  const shanghaiToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
  const marketMeta = await readMarketBoardMeta()
  const runIds = [...new Set([marketMeta?.currentRunId, ...(marketMeta?.historyRunIds || [])].filter(Boolean))]
  let benchmarkRows: Awaited<ReturnType<typeof readMarketBoardPointsRange>> = []
  let usedRun: string | null = null
  for (const runId of runIds) {
    const rows = await readMarketBoardPointsRange({
      runId, startDate: '2016-01-01', endDate: shanghaiToday,
    })
    if (!rows.length || rows.some((p) => !Number.isFinite(p.close) || p.close <= 0)
      || new Set(rows.map((p) => p.data_date)).size !== rows.length) continue
    benchmarkRows = rows
    usedRun = runId
    break
  }
  if (!benchmarkRows.length) throw new Error('暂无沪深300指数快照，请检查大盘看板刷新任务及 Supabase 配置。')
  const results = await Promise.allSettled(CN_STYLE_TARGETS.map(({ ticker }) => getRpsStyleSeries({ ticker })))
  const targets: Record<string, Array<Price & { high: number; low: number }>> = {}
  const notes: string[] = []
  const fetchedDates = [benchmarkRows[benchmarkRows.length - 1].fetched_at]
  let fallback = usedRun !== marketMeta?.currentRunId || marketMeta?.publishStatus !== 'ready'
  results.forEach((result, i) => {
    const ticker = CN_STYLE_TARGETS[i].ticker
    if (result.status === 'rejected') {
      notes.push(`${ticker}：${result.reason instanceof Error ? result.reason.message : '行情读取失败'}`)
      return
    }
    // Reuse stored adjusted ETF prices only, never the old benchmark's RPS/Score.
    targets[ticker] = result.value.data.series.map((p) => ({
      date: p.date, close: p.targetCloseQfq, high: p.targetHighQfq, low: p.targetLowQfq,
    }))
    fetchedDates.push(result.value.meta.fetchedAt)
    fallback ||= result.value.meta.isFallback
  })
  const data = buildCnStylePanel(benchmarkRows.map((p) => ({ date: p.data_date, close: p.close })), targets)
  const ageDays = (Date.parse(shanghaiToday) - Date.parse(data.dataDate)) / 86_400_000
  return {
    meta: {
      dataDate: data.dataDate, fetchedAt: fetchedDates.sort()[0],
      source: 'supabase:market_board_point + supabase:rps_style_point (ETF价格重算)',
      notes, stale: ageDays > 14, isFallback: fallback,
    },
    data,
  }
}
