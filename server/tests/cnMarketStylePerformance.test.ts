import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { createAsyncSnapshotCache } from '../../src/utils/asyncSnapshotCache.js'
import { buildUsPercentileSeries, type UsStylePoint } from '../../src/utils/usMarketStyle.js'

let clock = 0
let key = 'before-close'
let calls = 0
let fail = false
const cache = createAsyncSnapshotCache({
  ttlMs: 100, now: () => clock, key: () => key,
  load: async () => {
    calls += 1
    if (fail) throw new Error('read-failed')
    return calls
  },
})
const concurrent = await Promise.all(Array.from({ length: 20 }, () => cache.get()))
assert.ok(concurrent.every((value) => value === 1))
assert.equal(calls, 1)
assert.equal(await cache.get(), 1)
assert.equal(await cache.get(true), 2)
clock = 101
assert.equal(await cache.get(), 3)
key = 'after-close'
assert.equal(await cache.get(), 4)
fail = true
await assert.rejects(cache.get(true), /read-failed/)
fail = false
assert.equal(await cache.get(), 6, 'Failed refresh must invalidate the old result')
const partialCache = createAsyncSnapshotCache({
  ttlMs: 100, load: async () => ++calls, cacheable: () => false,
})
assert.notEqual(await partialCache.get(), await partialCache.get(), 'Partial results must not be cached')

const source: UsStylePoint[] = []
for (let i = 0; i < 2600; i++) {
  const d = new Date('2016-01-01T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + i * 2)
  const point: UsStylePoint = {
    date: d.toISOString().slice(0, 10), ticker: '159915.SZ', benchmarkTicker: '000300',
    targetCloseQfq: 1, targetHighQfq: 1, targetLowQfq: 1, benchmarkCloseQfq: 1,
    rpsRaw: 1, rpsMa50: 1, scorePct: i % 29 === 0 ? null : Math.round(Math.sin(i) * 10),
  }
  source.push(point)
  if (i % 157 === 0) source.push({ ...point, scorePct: 5 })
}
function reference(series: UsStylePoint[]) {
  const history: Array<{ date: string; score: number }> = []
  return [...series].sort((a, b) => a.date.localeCompare(b.date)).map((point) => {
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
    const result = { ...point, historyCount: values.length,
      percentile: ready ? 100 * (values.filter((v) => v < point.scorePct!).length
        + 0.5 * values.filter((v) => v === point.scorePct).length) / values.length : null,
      historicalCold: ready ? quantile(0.1) : null, historicalHot: ready ? quantile(0.9) : null }
    if (valid) history.push({ date: point.date, score: point.scorePct! })
    return result
  })
}
const before = performance.now()
const expected = reference(source)
const middle = performance.now()
const actual = buildUsPercentileSeries(source)
const after = performance.now()
assert.deepEqual(actual, expected, 'Optimized ranks, ties, duplicate dates and rolling quantiles must remain identical')
assert.deepEqual(buildUsPercentileSeries([...source].reverse()), reference([...source].reverse()))
console.log(`Percentile ${source.length} points: original ${(middle - before).toFixed(1)}ms, optimized ${(after - middle).toFixed(1)}ms`)
console.log('Snapshot TTL, concurrent coalescing, refresh, failures and cutoff invalidation passed')
