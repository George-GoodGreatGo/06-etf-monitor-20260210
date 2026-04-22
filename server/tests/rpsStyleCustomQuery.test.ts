import assert from 'node:assert/strict'
import { buildRpsComputedSeries, normalizeRpsCustomTickerInput } from '../lib/rpsStyle.js'

function day(n: number): string {
  const base = new Date(Date.UTC(2024, 0, 1))
  base.setUTCDate(base.getUTCDate() + (n - 1))
  return base.toISOString().slice(0, 10)
}

assert.equal(normalizeRpsCustomTickerInput('159915'), '159915.SZ')
assert.equal(normalizeRpsCustomTickerInput('510300'), '510300.SH')
assert.equal(normalizeRpsCustomTickerInput('sz159915'), '159915.SZ')
assert.equal(normalizeRpsCustomTickerInput('510300.sh'), '510300.SH')
assert.throws(() => normalizeRpsCustomTickerInput('abc123'), /ETF代码格式无效/)

const targetSeries = Array.from({ length: 60 }, (_, index) => ({
  date: day(index + 1),
  close: 100 + index,
}))
const benchmarkSeries = Array.from({ length: 60 }, (_, index) => ({
  date: day(index + 1),
  close: 50 + index * 0.5,
}))

const computed = buildRpsComputedSeries({
  ticker: '159915.SZ',
  benchmarkTicker: 'H30269',
  targetSeries,
  benchmarkSeries,
  maPeriod: 50,
})

assert.equal(computed.length, 60)
assert.equal(computed[0]?.date, day(1))
assert.equal(computed[0]?.rpsRaw, 2)
assert.equal(computed[48]?.rpsMa50 ?? null, null)
assert.ok(typeof computed[49]?.rpsMa50 === 'number')
assert.ok(typeof computed[59]?.scorePct === 'number')
assert.equal(computed[59]?.ticker, '159915.SZ')
assert.equal(computed[59]?.benchmarkTicker, 'H30269')
