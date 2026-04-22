import assert from 'node:assert/strict'
import { buildRpsTurnoverHistory, buildRpsTurnoverSummaryItem, getRpsStyleBenchmarkMeta, getRpsStyleComputationNotes } from '../lib/rpsStyle.js'

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

const longerDisplayWindow = buildRpsTurnoverHistory(
  Array.from({ length: 300 }, (_, index) => ({
    date: day(index + 1),
    turnover: index + 100,
  })),
  { lookbackDays: 20, displayDays: 250 },
)

assert.equal(longerDisplayWindow.length, 250)
assert.equal(longerDisplayWindow[0]?.date, day(51))
assert.equal(longerDisplayWindow[249]?.date, day(300))

const summaryHit = buildRpsTurnoverSummaryItem(
  { ticker: '512890.SH', code: '512890', name: '红利低波ETF' },
  buildRpsTurnoverHistory(
    [
      { date: '2024-01-02', turnover: 100 },
      { date: '2024-01-03', turnover: 100 },
      { date: '2024-01-04', turnover: 100 },
      { date: '2024-01-05', turnover: 100 },
      { date: '2024-01-08', turnover: 100 },
      { date: '2024-01-09', turnover: 100 },
      { date: '2024-01-10', turnover: 100 },
      { date: '2024-01-11', turnover: 100 },
      { date: '2024-01-12', turnover: 100 },
      { date: '2024-01-15', turnover: 100 },
      { date: '2024-01-16', turnover: 100 },
      { date: '2024-01-17', turnover: 100 },
      { date: '2024-01-18', turnover: 100 },
      { date: '2024-01-19', turnover: 100 },
      { date: '2024-01-22', turnover: 100 },
      { date: '2024-01-23', turnover: 100 },
      { date: '2024-01-24', turnover: 100 },
      { date: '2024-01-25', turnover: 100 },
      { date: '2024-01-26', turnover: 100 },
      { date: '2024-01-29', turnover: 100 },
      { date: '2024-01-30', turnover: 160 },
      { date: '2024-01-31', turnover: 100 },
    ],
    { lookbackDays: 20, displayDays: 90 },
  ),
)

assert.equal(summaryHit.latestTradingDate, '2024-01-31')
assert.equal(summaryHit.latestAmplifiedDate, '2024-01-30')
assert.equal(summaryHit.tradingDaysAgo, 1)
assert.equal(summaryHit.status, 'hit')

const summaryNoSignal = buildRpsTurnoverSummaryItem(
  { ticker: '159915.SZ', code: '159915', name: '创业板ETF' },
  buildRpsTurnoverHistory(
    Array.from({ length: 25 }, (_, index) => ({
      date: day(index + 1),
      turnover: 100,
    })),
    { lookbackDays: 20, displayDays: 90 },
  ),
)

assert.equal(summaryNoSignal.latestAmplifiedDate, null)
assert.equal(summaryNoSignal.tradingDaysAgo, null)
assert.equal(summaryNoSignal.status, 'no_signal')

const summaryNoData = buildRpsTurnoverSummaryItem(
  { ticker: '588000.SH', code: '588000', name: '科创50ETF' },
  [],
)

assert.equal(summaryNoData.latestTradingDate, null)
assert.equal(summaryNoData.latestAmplifiedDate, null)
assert.equal(summaryNoData.status, 'no_data')

const benchmarkMeta = getRpsStyleBenchmarkMeta()
assert.deepEqual(benchmarkMeta, {
  ticker: 'H30269',
  name: '红利低波全收益指数',
})

const notes = getRpsStyleComputationNotes()
assert.equal(notes[0], 'RPS=目标ETF前复权收盘价/H30269收盘点位')
assert.ok(notes.includes('benchmark=H30269 红利低波全收益指数'))
