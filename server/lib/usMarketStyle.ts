import { buildRpsComputedSeries } from './rpsStyle.js'
import { US_STYLE_BENCHMARK, US_STYLE_TARGETS, type UsStyleSnapshot, type UsStyleItem } from '../../src/utils/usMarketStyle.js'

export type AdjustedClose = { date: string; close: number }
type YahooChart = {
  chart?: { result?: Array<{
    meta?: { currency?: string; exchangeTimezoneName?: string; symbol?: string }
    timestamp?: number[]
    indicators?: { adjclose?: Array<{ adjclose?: Array<number | null> }> }
  }> }
}

async function fetchYahooChart(url: string): Promise<YahooChart> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Yahoo: HTTP ${response.status}`)
  return await response.json() as YahooChart
}

export function newYorkDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (key: string) => parts.find((p) => p.type === key)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function parseYahooAdjustedCloses(payload: unknown, todayNy: string): AdjustedClose[] {
  const result = (payload as YahooChart)?.chart?.result?.[0]
  if (!result || result.meta?.currency !== 'USD' || result.meta?.exchangeTimezoneName !== 'America/New_York') {
    throw new Error('Invalid US market metadata')
  }
  const timestamps = result.timestamp
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose
  if (!Array.isArray(timestamps) || !Array.isArray(adjusted) || timestamps.length !== adjusted.length) {
    throw new Error('Missing dividend-and-split-adjusted prices')
  }
  const points = new Map<string, number>()
  timestamps.forEach((timestamp, i) => {
    const close = adjusted[i]
    if (!Number.isFinite(timestamp)) return
    const date = newYorkDate(new Date(timestamp * 1000))
    // Exclude today's possibly incomplete bar, even during manual intraday refreshes.
    if (date >= todayNy || typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return
    points.set(date, close)
  })
  return [...points].sort(([a], [b]) => a.localeCompare(b)).map(([date, close]) => ({ date, close }))
}

export async function fetchUsAdjustedCloses(ticker: string, now = new Date()): Promise<AdjustedClose[]> {
  if (ticker !== US_STYLE_BENCHMARK && !US_STYLE_TARGETS.some((x) => x.ticker === ticker)) throw new Error('Unsupported US ticker')
  const params = new URLSearchParams({
    range: '5y',
    interval: '1d', events: 'div,splits', includeAdjustedClose: 'true',
  })
  let lastError: unknown
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const result = await fetchYahooChart(`https://${host}/v8/finance/chart/${ticker}?${params}`)
      if (result?.chart?.result?.[0]?.meta?.symbol !== ticker) throw new Error(`Unexpected symbol for ${ticker}`)
      return parseYahooAdjustedCloses(result, newYorkDate(now))
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export function buildUsStyleSnapshot(
  prices: Record<string, AdjustedClose[]>,
  now = new Date(),
): UsStyleSnapshot {
  const benchmark = prices[US_STYLE_BENCHMARK]
  if (!benchmark?.length) throw new Error(`Missing ${US_STYLE_BENCHMARK} history`)
  const dataDate = benchmark[benchmark.length - 1].date
  const age = (Date.parse(newYorkDate(now)) - Date.parse(dataDate)) / 86_400_000
  if (!Number.isFinite(age) || age < 1 || age > 7) throw new Error(`Stale or incomplete ${US_STYLE_BENCHMARK} data: ${dataDate}`)
  const allTickers = [US_STYLE_BENCHMARK, ...US_STYLE_TARGETS.map((x) => x.ticker)]
  const maps = allTickers.map((ticker) => {
    const series = prices[ticker]
    if (!series?.length || series[series.length - 1].date !== dataDate) throw new Error(`Latest session mismatch: ${ticker}`)
    const map = new Map(series.map((p) => [p.date, p.close]))
    if (map.size !== series.length || series.some((p) => !Number.isFinite(p.close) || p.close <= 0)) {
      throw new Error(`Invalid price history: ${ticker}`)
    }
    return map
  })
  // No forward fill: all ETFs must share the same actual trading sessions.
  const dates = benchmark.map((p) => p.date).filter((date) => maps.every((map) => map.has(date))).sort()
  if (dates.length < 252) throw new Error('Insufficient common trading history')
  for (const ticker of allTickers) {
    if (prices[ticker].slice(-252).some((p) => !dates.includes(p.date))) throw new Error(`Missing recent session: ${ticker}`)
  }
  const commonBenchmark = dates.map((date) => ({ date, close: maps[0].get(date)! }))
  const seriesByTicker: UsStyleSnapshot['seriesByTicker'] = {}
  const items: UsStyleItem[] = []
  US_STYLE_TARGETS.forEach(({ ticker }, targetIndex) => {
    const series = buildRpsComputedSeries({
      ticker, benchmarkTicker: US_STYLE_BENCHMARK,
      targetSeries: dates.map((date) => ({ date, close: maps[targetIndex + 1].get(date)! })),
      benchmarkSeries: commonBenchmark, maPeriod: 50,
    })
    seriesByTicker[ticker] = series
    const last = series[series.length - 1]
    const scorePct = last.scorePct!
    const scoreChange5dPp = scorePct - series[series.length - 6].scorePct!
    const relativeReturn20dPct = (last.rpsRaw / series[series.length - 21].rpsRaw - 1) * 100
    const trend = scoreChange5dPp > 0.1 ? 'up' : scoreChange5dPp < -0.1 ? 'down' : 'flat'
    const quadrant = trend === 'flat' ? '动量平稳'
      : scorePct >= 0 ? (trend === 'up' ? '领先走强' : '领先走弱')
        : trend === 'up' ? '落后修复' : '落后走弱'
    items.push({ ticker, scorePct, scoreChange5dPp, relativeReturn20dPct, trend, quadrant })
  })
  items.sort((a, b) => b.scorePct - a.scorePct)
  return {
    version: 1, benchmarkTicker: US_STYLE_BENCHMARK, dataDate, fetchedAt: now.toISOString(),
    source: 'Yahoo Finance adjusted close', priceBasis: 'dividend-and-split-adjusted',
    seriesByTicker, items,
  }
}

function supabaseConfig(write = false) {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = write ? process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim()
  if (!url || !key) throw new Error('Missing Supabase configuration')
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
}

export async function publishUsStyleSnapshot(snapshot: UsStyleSnapshot): Promise<void> {
  const { url, headers } = supabaseConfig(true)
  const response = await fetch(`${url}/rest/v1/rpc/publish_us_market_style`, {
    method: 'POST', headers, body: JSON.stringify({ p_snapshot: snapshot }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`Publish US style failed: HTTP ${response.status} ${await response.text()}`)
}

export async function readUsStyleSnapshot(): Promise<UsStyleSnapshot | null> {
  const { url, headers } = supabaseConfig()
  const response = await fetch(`${url}/rest/v1/us_market_style_snapshot?id=eq.default&select=payload`, {
    headers, signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Read US style failed: HTTP ${response.status}`)
  const rows = await response.json()
  return rows[0]?.payload ?? null
}
