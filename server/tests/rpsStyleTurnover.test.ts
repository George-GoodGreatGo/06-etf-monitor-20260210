import assert from 'node:assert/strict'
import { buildRpsTurnoverHistory } from '../lib/rpsStyle.js'

function day(n: number): string {
  const base = new Date(Date.UTC(2024, 0, 1))
  base.setUTCDate(base.getUTCDate() + (n - 1))
  return base.toISOString().slice(0, 10)
}

const shortHistory = buildRpsTurnoverHistory(
  Array.from({ length: 25 }, (_, index) => ({
    date: day(index + 1),
    turnover: index + 1,
  })),
  { lookbackDays: 20, displayDays: 90 },
)

assert.equal(shortHistory.length, 25)
assert.equal(shortHistory[19]?.turnoverMultipleOfPrev20Avg ?? null, null)
assert.equal(shortHistory[20]?.turnoverMultipleOfPrev20Avg ?? null, 2)

const longHistory = buildRpsTurnoverHistory(
  Array.from({ length: 130 }, (_, index) => ({
    date: day(index + 1),
    turnover: index + 1,
  })),
  { lookbackDays: 20, displayDays: 90 },
)

assert.equal(longHistory.length, 90)
assert.equal(longHistory[0]?.date, day(41))
assert.equal(longHistory[0]?.turnoverMultipleOfPrev20Avg ?? null, 1.34)
assert.equal(longHistory[89]?.date, day(130))
assert.equal(longHistory[89]?.turnoverMultipleOfPrev20Avg ?? null, 1.09)

const withMissingTurnover = buildRpsTurnoverHistory(
  Array.from({ length: 25 }, (_, index) => ({
    date: day(index + 1),
    turnover: index === 5 ? null : 100,
  })),
  { lookbackDays: 20, displayDays: 90 },
)

assert.equal(withMissingTurnover[20]?.turnoverMultipleOfPrev20Avg ?? null, null)
