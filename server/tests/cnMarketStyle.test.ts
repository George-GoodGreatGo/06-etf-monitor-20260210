import assert from 'node:assert/strict'
import { buildCnStylePanel } from '../lib/cnMarketStyle.js'
import { CN_STYLE_TARGETS, CN_STYLE_CHART_TARGETS, CN_STYLE_DATA_TARGETS, CN_STYLE_TURNOVER_TICKERS, CN_STYLE_NAME_MAP, cnDefaultChartSelection, cnPercentileZone, selectCnChartSeries, buildCnPercentileSeries, cnMomentumState } from '../../src/utils/cnMarketStyle.js'
import { RPS_BENCHMARK_TICKER, RPS_TARGET_TICKERS, RPS_SNAPSHOT_TICKERS, getRpsStyleSupportedTickers, getRpsStyleSeries } from '../lib/rpsStyle.js'

const dates: string[] = []
for (const d = new Date('2024-01-02T00:00:00Z'); d < new Date('2026-10-21T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() && d.getUTCDay() !== 6 && !d.toISOString().startsWith('2026-10-0')) dates.push(d.toISOString().slice(0, 10))
}
const benchmark = dates.map((date, i) => ({ date, close: 3000 * Math.exp(i * 0.001) }))
const targets = Object.fromEntries(CN_STYLE_DATA_TARGETS.map(({ ticker }, i) => [
  ticker, dates.map((date, j) => ({ date, close: 2 * Math.exp(j * (ticker === '159263.SZ' ? 0.006 : (i - 2) * 0.001)) })),
]))
const now = new Date('2026-10-20T08:00:00Z')
assert.equal(RPS_TARGET_TICKERS.length, 9)
assert.ok(!RPS_TARGET_TICKERS.some((ticker: string) => ticker === '512890.SH'))
assert.equal(RPS_SNAPSHOT_TICKERS.length, 10)
assert.ok(getRpsStyleSupportedTickers().includes('512890.SH'), 'Reference must be collected by the snapshot workflow')
for (const { ticker } of CN_STYLE_DATA_TARGETS) assert.ok(getRpsStyleSupportedTickers().includes(ticker))
const originalFetch = globalThis.fetch
const originalUrl = process.env.SUPABASE_URL
const originalKey = process.env.SUPABASE_ANON_KEY
try {
  process.env.SUPABASE_URL = 'https://example.invalid'
  process.env.SUPABASE_ANON_KEY = 'test-only'
  globalThis.fetch = async () => { throw new Error('snapshot-read-reached') }
  await assert.rejects(getRpsStyleSeries({ ticker: '512890.SH' }), /snapshot-read-reached/)
} finally {
  globalThis.fetch = originalFetch
  if (originalUrl === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalUrl
  if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY
  else process.env.SUPABASE_ANON_KEY = originalKey
}
const result = buildCnStylePanel(benchmark, targets, now)
assert.equal(RPS_BENCHMARK_TICKER, 'H30269', 'Existing strategy benchmark must remain unchanged')
assert.equal(result.benchmarkTicker, '000300')
assert.equal(result.dataDate, '2026-10-20')
assert.equal(result.items.length, CN_STYLE_TARGETS.length)
assert.equal(result.items.length, 9)
assert.ok(!result.items.some((x) => x.ticker === '510300.SH'))
assert.ok(result.items.some((x) => x.ticker === '512890.SH'))
const expectedTickers = CN_STYLE_TARGETS.map((x) => x.ticker).sort()
for (const list of [
  CN_STYLE_CHART_TARGETS.map((x) => x.ticker), CN_STYLE_DATA_TARGETS.map((x) => x.ticker),
  CN_STYLE_TURNOVER_TICKERS, result.items.map((x) => x.ticker), Object.keys(result.seriesByTicker),
]) {
  assert.equal(new Set(list).size, 9, 'Module ticker lists must not contain duplicates')
  assert.deepEqual([...list].sort(), expectedTickers, 'All overview modules must cover the same tickers')
}
for (const { ticker, name } of CN_STYLE_TARGETS) assert.equal(CN_STYLE_NAME_MAP[ticker], name)
assert.ok(!CN_STYLE_TURNOVER_TICKERS.includes('510300.SH'))
assert.ok(CN_STYLE_TURNOVER_TICKERS.includes('512890.SH'))
assert.deepEqual(Object.entries(cnDefaultChartSelection()).filter(([, enabled]) => enabled).map(([ticker]) => ticker), ['159915.SZ', '512890.SH'])
assert.equal(cnPercentileZone(0), '过冷区')
assert.equal(cnPercentileZone(10), '过冷区')
assert.equal(cnPercentileZone(10.01), '其它')
assert.equal(cnPercentileZone(89.99), '其它')
assert.equal(cnPercentileZone(90), '过热区')
assert.equal(cnPercentileZone(100), '过热区')
for (const value of [null, undefined, NaN, Infinity, -1, 101]) assert.equal(cnPercentileZone(value), '暂无有效百分位')
const chart = selectCnChartSeries(result.seriesByTicker)
assert.equal(Object.keys(chart).length, CN_STYLE_CHART_TARGETS.length)
assert.ok(!('510300.SH' in chart))
assert.ok(chart['512890.SH'].at(-1)!.percentile != null)
assert.equal(chart['512890.SH'].at(-1)!.benchmarkTicker, '000300')
const noReference = structuredClone(targets)
delete noReference['512890.SH']
const withoutReference = buildCnStylePanel(benchmark, noReference, now)
assert.deepEqual(withoutReference.items.filter((x) => x.ticker !== '512890.SH'), result.items.filter((x) => x.ticker !== '512890.SH'))
assert.equal(withoutReference.items.find((x) => x.ticker === '512890.SH')?.scorePct, null)
assert.deepEqual(selectCnChartSeries(withoutReference.seriesByTicker)['512890.SH'], [])
const reference = result.items.find((x) => x.ticker === '512890.SH')!
const referenceSeries = result.seriesByTicker['512890.SH']
assert.equal(reference.percentile, referenceSeries.at(-1)!.percentile)
assert.equal(reference.scorePct, referenceSeries.at(-1)!.scorePct)
assert.equal(reference.scoreChange5dPp, referenceSeries.at(-1)!.scorePct! - referenceSeries.at(-6)!.scorePct!)
assert.equal(reference.relativeReturn20dPct, (referenceSeries.at(-1)!.rpsRaw / referenceSeries.at(-21)!.rpsRaw - 1) * 100)
const growth = result.seriesByTicker['159263.SZ']
const last = growth[growth.length - 1]
assert.equal(growth[48].scorePct, null)
assert.ok(Math.abs(last.rpsMa50! - growth.slice(-50).reduce((s, p) => s + p.rpsRaw, 0) / 50) < 1e-10)
const item = result.items.find((x) => x.ticker === '159263.SZ')!
assert.ok(Math.abs(item.relativeReturn20dPct! - (Math.exp(20 * 0.005) - 1) * 100) < 1e-10)
assert.ok(Math.abs(item.scoreChange5dPp! - (last.scorePct! - growth[growth.length - 6].scorePct!)) < 1e-10)
assert.equal(buildCnStylePanel(benchmark, targets, new Date('2026-10-20T06:00:00Z')).dataDate, '2026-10-19')
assert.equal(buildCnStylePanel([...benchmark, { date: '2027-01-01', close: 1 }], targets, now).dataDate, '2026-10-20')
const changed = buildCnStylePanel(benchmark.map((p) => ({ ...p, close: 3000 })), targets, now)
assert.notEqual(changed.items[0].scorePct, result.items[0].scorePct)
const missing = structuredClone(targets)
missing['159915.SZ'].pop()
const withoutLatest = buildCnStylePanel(benchmark, missing, now)
assert.equal(withoutLatest.items.find((x) => x.ticker === '159915.SZ')?.scorePct, null)
assert.equal(withoutLatest.items.find((x) => x.ticker === '159915.SZ')?.trend, 'unavailable')
const suspended = structuredClone(targets)
suspended['588000.SH'].splice(-25, 1)
const suspendedResult = buildCnStylePanel(benchmark, suspended, now)
assert.equal(suspendedResult.items.find((x) => x.ticker === '588000.SH')?.scorePct, null)
assert.deepEqual(suspendedResult.seriesByTicker['159263.SZ'], growth, 'One instrument must not shorten other histories')
const young = structuredClone(targets)
young['159259.SZ'] = young['159259.SZ'].slice(-100)
const youngResult = buildCnStylePanel(benchmark, young, now).items.find((x) => x.ticker === '159259.SZ')!
assert.notEqual(youngResult.scorePct, null)
assert.equal(youngResult.percentile, null)
assert.equal(youngResult.historyCount, 50)
assert.deepEqual(cnMomentumState(2, -0.3), { trend: 'down', quadrant: '领先走弱' })
assert.deepEqual(cnMomentumState(-2, 0.3), { trend: 'up', quadrant: '落后修复' })
assert.equal(cnMomentumState(1, 0.2).trend, 'flat')
const ties = growth.map((p) => ({ ...p, scorePct: 1 }))
assert.equal(buildCnPercentileSeries(ties)[252].percentile, 50)
assert.equal(buildCnPercentileSeries(ties)[251].percentile, null)
const causal = buildCnPercentileSeries(growth.slice(0, 400))
assert.deepEqual(causal, growth.slice(0, 400), 'Future data must not change historical percentiles')
assert.throws(() => buildCnStylePanel([...benchmark, benchmark[0]], targets, now), /行情无效/)
assert.throws(() => buildCnStylePanel([], targets, now), /历史为空/)
console.log('cnMarketStyle tests passed')
