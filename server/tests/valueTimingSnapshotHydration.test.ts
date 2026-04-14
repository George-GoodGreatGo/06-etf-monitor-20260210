import assert from 'node:assert/strict'
import { hydrateValueTimingSeriesWithDerivedMetrics } from '../lib/valueTiming.js'

const raw: Array<Record<string, unknown>> = []
const base = new Date(Date.UTC(2023, 0, 1))
for (let i = 0; i < 320; i += 1) {
  const d = new Date(base.getTime() + i * 86_400_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const close = 100 + i * 0.1
  const pe = 10 + (i % 15) * 0.1
  raw.push({
    date: `${y}-${m}-${day}`,
    close,
    pe,
    earningsYieldPct: 100 / pe,
    yield10yPct: 2 + (i % 10) * 0.01,
  })
}

const out = hydrateValueTimingSeriesWithDerivedMetrics(raw)
assert.equal(out.series.length, 320)
assert.equal(out.hydrationApplied, true)
assert.ok(out.notes.some((x) => x.includes('derived_from_snapshot=1')))

const last = out.series[out.series.length - 1]
assert.equal(typeof last.ma60, 'number')
assert.equal(typeof last.ma250, 'number')
assert.equal(typeof last.bias60, 'number')
assert.equal(typeof last.bias250, 'number')

const rawWithDupAndBroken = [
  { date: '2024-01-03', close: 99 },
  { date: 'bad-date', close: 1 },
  { date: '2024-01-03', close: 100 },
  { date: '2024-01-04', close: 101 },
]
const out2 = hydrateValueTimingSeriesWithDerivedMetrics(rawWithDupAndBroken)
assert.equal(out2.series.length, 2)
assert.equal(out2.series[0].date, '2024-01-03')
assert.equal(out2.series[0].close, 100)
