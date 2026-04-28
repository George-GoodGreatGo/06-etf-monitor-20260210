import assert from 'node:assert/strict'
import {
  buildMomentumSignalsByStrategy,
  computeMomentumSignalSnapshot,
} from '../../src/utils/momentumSignalSnapshot.ts'
import type { RpsStyleSeriesPoint } from '../../src/utils/marketApi.ts'

function formatYmd(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildBusinessDates(count: number, start = '2025-01-02'): string[] {
  const out: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  while (out.length < count) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) out.push(formatYmd(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function buildSeries(values: number[], scores: Array<number | null>, start = '2025-01-02'): RpsStyleSeriesPoint[] {
  const dates = buildBusinessDates(values.length, start)
  return values.map((value, index) => ({
    date: dates[index],
    ticker: '510300.SH',
    benchmarkTicker: 'H30269',
    targetCloseQfq: value,
    benchmarkCloseQfq: 100,
    rpsRaw: value / 100,
    rpsMa50: 1,
    scorePct: scores[index] ?? null,
  }))
}

function testConfirmTrail12BuyToday() {
  const prices = new Array(250).fill(100)
  const scores = new Array<number | null>(250).fill(-2)
  prices.push(110, 112, 114)
  scores.push(5, 6, 7)
  const series = buildSeries(prices, scores)
  const result = computeMomentumSignalSnapshot({
    series,
    signalPreset: 'confirmTrail12',
    referenceDate: series[series.length - 1]?.date ?? null,
  })
  assert.equal(result.signalKey, 'buy')
  assert.equal(result.signalLabel, '买')
  assert.equal(result.freshnessBucket, 'within_3d')
}

function testConfirmTrail12RiskSell() {
  const prices = new Array(250).fill(100)
  const scores = new Array<number | null>(250).fill(-2)
  prices.push(110, 116, 120, 105, 104)
  scores.push(5, 6, 7, 6, 5)
  const series = buildSeries(prices, scores)
  const result = computeMomentumSignalSnapshot({
    series,
    signalPreset: 'confirmTrail12',
    referenceDate: series[series.length - 1]?.date ?? null,
  })
  assert.equal(result.signalKey, 'risk_sell')
  assert.equal(result.signalLabel, '风控卖')
  assert.equal(result.freshnessBucket, 'within_3d')
}

function testBaseColorFlipSellWithin5d() {
  const prices = [100, 101, 102, 103, 104, 103, 102, 101]
  const scores: Array<number | null> = [-3, 5, 6, 7, -2, -3, -4, -5]
  const series = buildSeries(prices, scores)
  const result = computeMomentumSignalSnapshot({
    series,
    signalPreset: 'baseColorFlip',
    referenceDate: series[series.length - 1]?.date ?? null,
  })
  assert.equal(result.signalKey, 'sell')
  assert.equal(result.signalLabel, '卖')
  assert.equal(result.freshnessBucket, 'within_5d')
}

function testBuildMomentumSignalsByStrategy() {
  const prices = new Array(250).fill(100)
  const scores = new Array<number | null>(250).fill(-2)
  prices.push(110, 112, 90)
  scores.push(5, 6, -4)
  const series = buildSeries(prices, scores)
  const out = buildMomentumSignalsByStrategy({
    series,
    referenceDate: series[series.length - 1]?.date ?? null,
    strategies: [
      { id: 'confirmTrail12', signalPreset: 'confirmTrail12' },
      { id: 'baseColorFlip', signalPreset: 'baseColorFlip' },
    ],
  })
  assert.equal(out.confirmTrail12?.signalKey, 'risk_sell')
  assert.equal(out.baseColorFlip?.signalKey, 'sell')
}

function main() {
  testConfirmTrail12BuyToday()
  testConfirmTrail12RiskSell()
  testBaseColorFlipSellWithin5d()
  testBuildMomentumSignalsByStrategy()
  console.log('top200MomentumSignals.test.ts: ok')
}

main()
