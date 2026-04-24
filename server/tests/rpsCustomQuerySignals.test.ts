import assert from 'node:assert/strict'
import { buildMomentumSignalStates } from '../../src/utils/rpsCustomQuerySignals.ts'

const samplePoints = [
  {
    time: 1,
    date: '2026-01-01',
    targetCloseQfq: 10,
    scorePct: -5,
    sma20: 9.8,
    sma60: 9.9,
    sma250: 9.7,
    rsi14: 48,
    macdDiff: -0.3,
    macdDea: -0.2,
    macdHist: -0.1,
  },
  {
    time: 2,
    date: '2026-01-02',
    targetCloseQfq: 10.2,
    scorePct: 4,
    sma20: 10.0,
    sma60: 10.1,
    sma250: 9.8,
    rsi14: 60,
    macdDiff: 0.3,
    macdDea: 0.2,
    macdHist: 0.1,
  },
  {
    time: 3,
    date: '2026-01-03',
    targetCloseQfq: 10.05,
    scorePct: -2,
    sma20: 10.0,
    sma60: 9.98,
    sma250: 9.85,
    rsi14: 44,
    macdDiff: -0.05,
    macdDea: 0.02,
    macdHist: -0.07,
  },
  {
    time: 4,
    date: '2026-01-04',
    targetCloseQfq: 10.4,
    scorePct: 5,
    sma20: 10.2,
    sma60: 10.1,
    sma250: 9.9,
    rsi14: 62,
    macdDiff: 0.4,
    macdDea: 0.25,
    macdHist: 0.15,
  },
  {
    time: 5,
    date: '2026-01-05',
    targetCloseQfq: 9.7,
    scorePct: 3,
    sma20: 10.1,
    sma60: 10.0,
    sma250: 9.9,
    rsi14: 52,
    macdDiff: 0.1,
    macdDea: 0.12,
    macdHist: -0.02,
  },
  {
    time: 6,
    date: '2026-01-06',
    targetCloseQfq: 9.5,
    scorePct: -3,
    sma20: 9.95,
    sma60: 9.98,
    sma250: 9.8,
    rsi14: 40,
    macdDiff: -0.2,
    macdDea: -0.1,
    macdHist: -0.1,
  },
  {
    time: 7,
    date: '2026-01-07',
    targetCloseQfq: 9.4,
    scorePct: -4,
    sma20: 9.8,
    sma60: 9.9,
    sma250: 9.75,
    rsi14: 38,
    macdDiff: -0.3,
    macdDea: -0.15,
    macdHist: -0.15,
  },
] as const

const defaultStates = buildMomentumSignalStates([...samplePoints], 'default')
const conservativeStates = buildMomentumSignalStates([...samplePoints], 'conservative')

assert.deepEqual(
  defaultStates.filter((state) => state.arrow).map((state) => `${state.date}:${state.arrow}`),
  ['2026-01-02:buy', '2026-01-05:sell'],
)

assert.deepEqual(
  conservativeStates.filter((state) => state.arrow).map((state) => `${state.date}:${state.arrow}`),
  ['2026-01-04:buy', '2026-01-05:sell'],
)

assert.equal(defaultStates[1]?.buyEligible, true)
assert.equal(conservativeStates[1]?.buyEligible, false)
assert.equal(conservativeStates[3]?.buyEligible, true)
assert.equal(defaultStates[4]?.stopTriggered, true)
assert.equal(conservativeStates[4]?.sellEligible, true)
