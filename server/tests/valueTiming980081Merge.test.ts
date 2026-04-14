import assert from 'node:assert/strict'
import { merge980081PeSeries } from '../lib/valueTiming.js'

const baseline = [
  { date: '2026-04-11', pe: 10.1 },
  { date: '2026-04-12', pe: 10.2 },
  { date: '2026-04-13', pe: 10.3 },
]

const withOverride = merge980081PeSeries({
  baseline,
  latest: { tradeDate: '2026-04-13', pe: 12.34 },
})
assert.equal(withOverride.baselinePoints, 3)
assert.equal(withOverride.newDailyPoints, 1)
assert.equal(withOverride.overwriteDays, 1)
assert.equal(withOverride.dailyDate, '2026-04-13')
assert.equal(withOverride.merged.get('2026-04-13'), 12.34)

const withAppend = merge980081PeSeries({
  baseline,
  latest: { tradeDate: '2026-04-14', pe: 12.5 },
})
assert.equal(withAppend.newDailyPoints, 1)
assert.equal(withAppend.overwriteDays, 0)
assert.equal(withAppend.merged.get('2026-04-14'), 12.5)

const missingLatest = merge980081PeSeries({
  baseline,
  latest: { tradeDate: null, pe: null },
})
assert.equal(missingLatest.newDailyPoints, 0)
assert.equal(missingLatest.overwriteDays, 0)
assert.equal(missingLatest.merged.size, 3)
