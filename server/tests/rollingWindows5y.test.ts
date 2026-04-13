import assert from 'node:assert/strict'
import { buildEquityBondValuePctSeries } from '../lib/equityBondValue.js'
import { buildLiquidityV5Series } from '../lib/liquidityV5.js'

function ymd8(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400_000)
}

const start = new Date(Date.UTC(2020, 0, 1))
const n = 700
const hs300: Record<string, unknown>[] = []
const sh: Record<string, unknown>[] = []
const sz: Record<string, unknown>[] = []
const north: Record<string, unknown>[] = []

for (let i = 0; i < n; i += 1) {
  const d = ymd8(addUtcDays(start, i))
  hs300.push({ trade_date: d, close: 3000 + i })
  sh.push({ trade_date: d, amount: 1000 + i, tr: 1 + i / 1000 })
  sz.push({ trade_date: d, amount: 2000 + i, tr: 2 + i / 1000 })
  north.push({ trade_date: d, north_money: 10 + i })
}

const liq = buildLiquidityV5Series({ hs300, sh, sz, north })
assert.equal(liq.length, n)
assert.equal(liq[628]?.amountPct ?? null, null)
assert.equal(liq[629]?.amountPct ?? null, 100)
assert.equal(liq[628]?.v5 ?? null, null)
assert.equal(typeof liq[629]?.v5, 'number')

const dates = liq.map((p) => p.date)
const peByDate = new Map<string, number>()
const yield10yPctByDate = new Map<string, number>()
for (const d of dates) {
  peByDate.set(d, 10)
  yield10yPctByDate.set(d, 2)
}

const eb = buildEquityBondValuePctSeries({ dates, peByDate, yield10yPctByDate })
assert.equal(eb.length, n)
assert.equal(eb[628]?.pct ?? null, null)
assert.equal(typeof eb[629]?.pct, 'number')

