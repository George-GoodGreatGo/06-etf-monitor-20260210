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

const preserve = hydrateValueTimingSeriesWithDerivedMetrics([
  { date: '2024-01-02', close: 100, ma60: 123, ma250: 456, bias60: 0.1, bias250: 0.2 },
  { date: '2024-01-03', close: 101 },
  { date: '2024-01-04', close: 102 },
  { date: '2024-01-05', close: 103 },
  { date: '2024-01-06', close: 104 },
  { date: '2024-01-07', close: 105 },
  { date: '2024-01-08', close: 106 },
  { date: '2024-01-09', close: 107 },
  { date: '2024-01-10', close: 108 },
  { date: '2024-01-11', close: 109 },
  { date: '2024-01-12', close: 110 },
  { date: '2024-01-13', close: 111 },
  { date: '2024-01-14', close: 112 },
  { date: '2024-01-15', close: 113 },
  { date: '2024-01-16', close: 114 },
  { date: '2024-01-17', close: 115 },
  { date: '2024-01-18', close: 116 },
  { date: '2024-01-19', close: 117 },
  { date: '2024-01-20', close: 118 },
  { date: '2024-01-21', close: 119 },
  { date: '2024-01-22', close: 120 },
  { date: '2024-01-23', close: 121 },
  { date: '2024-01-24', close: 122 },
  { date: '2024-01-25', close: 123 },
  { date: '2024-01-26', close: 124 },
  { date: '2024-01-27', close: 125 },
  { date: '2024-01-28', close: 126 },
  { date: '2024-01-29', close: 127 },
  { date: '2024-01-30', close: 128 },
  { date: '2024-01-31', close: 129 },
  { date: '2024-02-01', close: 130 },
  { date: '2024-02-02', close: 131 },
  { date: '2024-02-03', close: 132 },
  { date: '2024-02-04', close: 133 },
  { date: '2024-02-05', close: 134 },
  { date: '2024-02-06', close: 135 },
  { date: '2024-02-07', close: 136 },
  { date: '2024-02-08', close: 137 },
  { date: '2024-02-09', close: 138 },
  { date: '2024-02-10', close: 139 },
  { date: '2024-02-11', close: 140 },
  { date: '2024-02-12', close: 141 },
  { date: '2024-02-13', close: 142 },
  { date: '2024-02-14', close: 143 },
  { date: '2024-02-15', close: 144 },
  { date: '2024-02-16', close: 145 },
  { date: '2024-02-17', close: 146 },
  { date: '2024-02-18', close: 147 },
  { date: '2024-02-19', close: 148 },
  { date: '2024-02-20', close: 149 },
  { date: '2024-02-21', close: 150 },
  { date: '2024-02-22', close: 151 },
  { date: '2024-02-23', close: 152 },
  { date: '2024-02-24', close: 153 },
  { date: '2024-02-25', close: 154 },
  { date: '2024-02-26', close: 155 },
  { date: '2024-02-27', close: 156 },
  { date: '2024-02-28', close: 157 },
  { date: '2024-02-29', close: 158 },
  { date: '2024-03-01', close: 159 },
  { date: '2024-03-02', close: 160 },
])
assert.equal(preserve.series[0].ma60, 123)
assert.equal(preserve.series[0].ma250, 456)
assert.equal(preserve.series[0].bias60, 0.1)
assert.equal(preserve.series[0].bias250, 0.2)
