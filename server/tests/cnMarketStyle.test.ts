import assert from 'node:assert/strict'
import { buildCnStylePanel } from '../lib/cnMarketStyle.js'
import { CN_STYLE_TARGETS, buildCnPercentileSeries, cnMomentumState } from '../../src/utils/cnMarketStyle.js'
import { RPS_BENCHMARK_TICKER } from '../lib/rpsStyle.js'

const dates: string[] = []
for (const d = new Date('2024-01-02T00:00:00Z'); d < new Date('2026-10-21T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() && d.getUTCDay() !== 6 && !d.toISOString().startsWith('2026-10-0')) dates.push(d.toISOString().slice(0, 10))
}
const benchmark = dates.map((date, i) => ({ date, close: 3000 * Math.exp(i * 0.001) }))
const targets = Object.fromEntries(CN_STYLE_TARGETS.map(({ ticker }, i) => [
  ticker, dates.map((date, j) => ({ date, close: 2 * Math.exp(j * (i - 2) * 0.001) })),
]))
const now = new Date('2026-10-20T08:00:00Z')
const result = buildCnStylePanel(benchmark, targets, now)
assert.equal(RPS_BENCHMARK_TICKER, 'H30269', 'Existing strategy benchmark must remain unchanged')
assert.equal(result.benchmarkTicker, '000300')
assert.equal(result.dataDate, '2026-10-20')
const growth = result.seriesByTicker['159263.SZ']
const last = growth[growth.length - 1]
assert.equal(growth[48].scorePct, null)
assert.ok(Math.abs(last.rpsMa50! - growth.slice(-50).reduce((s, p) => s + p.rpsRaw, 0) / 50) < 1e-10)
const item = result.items.find((x) => x.ticker === '159263.SZ')!
assert.ok(Math.abs(item.relativeReturn20dPct! - (Math.exp(20 * 0.005) - 1) * 100) < 1e-10)
assert.ok(Math.abs(item.scoreChange5dPp! - (last.scorePct! - growth[growth.length - 6].scorePct!)) < 1e-10)
assert.ok(Math.abs(result.items.find((x) => x.ticker === '510300.SH')!.scorePct!) < 1e-10)
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
