import assert from 'node:assert/strict'
import { calcEarningsYieldPctFromPe, calcSpreadPct } from '../lib/valueTiming.js'

assert.equal(calcEarningsYieldPctFromPe(null), null)
assert.equal(calcEarningsYieldPctFromPe(0), null)
assert.equal(calcEarningsYieldPctFromPe(-1), null)
assert.equal(calcEarningsYieldPctFromPe(10), 10)
assert.equal(calcEarningsYieldPctFromPe(25), 4)

assert.equal(calcSpreadPct(null, 2), null)
assert.equal(calcSpreadPct(10, null), null)
assert.equal(calcSpreadPct(10, 2), 8)
assert.equal(calcSpreadPct(4, 3.5), 0.5)

