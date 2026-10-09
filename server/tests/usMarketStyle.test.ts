import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildUsStyleSnapshot, newYorkDate, parseYahooAdjustedCloses, type AdjustedClose } from '../lib/usMarketStyle.js'
import { buildUsPercentileSeries, computeUsScoreZones, isCurrentUsStyleSnapshot, US_STYLE_TARGETS } from '../../src/utils/usMarketStyle.js'

const now = new Date('2026-10-09T06:35:00Z')
const dates: string[] = []
for (let d = new Date('2025-01-01T00:00:00Z'); d < new Date('2026-10-09T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10))
}
const prices: Record<string, AdjustedClose[]> = {
  VOO: dates.map((date) => ({ date, close: 25 })),
}
US_STYLE_TARGETS.forEach(({ ticker }, i) => {
  prices[ticker] = dates.map((date, index) => ({ date, close: 50 * Math.exp(index * (i - 2) * 0.001) }))
})
const snapshot = buildUsStyleSnapshot(prices, now)
assert.equal(snapshot.dataDate, '2026-10-08')
assert.equal(snapshot.items.length, US_STYLE_TARGETS.length)
assert.deepEqual(snapshot.items.map((x) => x.ticker), ['SMH', 'QQQM', 'SCHD', 'VGT', 'VIG', 'VYM'])
assert.equal(snapshot.benchmarkTicker, 'VOO')
assert.equal(snapshot.seriesByTicker.VOO, undefined)
assert.equal(snapshot.seriesByTicker.SCHD[0].benchmarkTicker, 'VOO')
assert.ok(isCurrentUsStyleSnapshot(snapshot))
const oldBasis = structuredClone(snapshot)
Object.assign(oldBasis, { benchmarkTicker: 'SCHD' })
assert.equal(isCurrentUsStyleSnapshot(oldBasis), false)
const mixedBasis = structuredClone(snapshot)
mixedBasis.seriesByTicker.SCHD[0].benchmarkTicker = 'SCHD'
assert.equal(isCurrentUsStyleSnapshot(mixedBasis), false)
const withoutBenchmark = structuredClone(prices)
delete withoutBenchmark.VOO
assert.throws(() => buildUsStyleSnapshot(withoutBenchmark, now), /Missing VOO history/)
const withoutSchd = structuredClone(prices)
delete withoutSchd.SCHD
assert.throws(() => buildUsStyleSnapshot(withoutSchd, now), /mismatch: SCHD/)
const movingBenchmark = structuredClone(prices)
movingBenchmark.VOO.forEach((p, i) => { p.close *= Math.exp(i * 0.001) })
const rebased = buildUsStyleSnapshot(movingBenchmark, now)
assert.ok(Math.abs(rebased.items.find((x) => x.ticker === 'QQQM')!.relativeReturn20dPct
  - (Math.exp(20 * 0.001) - 1) * 100) < 1e-10)
assert.notEqual(rebased.items.find((x) => x.ticker === 'SCHD')!.scorePct,
  snapshot.items.find((x) => x.ticker === 'SCHD')!.scorePct)
assert.equal(snapshot.seriesByTicker.VGT[48].scorePct, null)
assert.equal(snapshot.seriesByTicker.VGT[49].scorePct, 0)
assert.equal(snapshot.items.find((x) => x.ticker === 'VGT')?.trend, 'flat')
const qSeries = snapshot.seriesByTicker.QQQM
const last = qSeries[qSeries.length - 1]
const mean = qSeries.slice(-50).reduce((sum, p) => sum + p.rpsRaw, 0) / 50
assert.ok(Math.abs(last.rpsMa50! - mean) < 1e-10)
assert.ok(Math.abs(last.scorePct! - (last.rpsRaw / mean - 1) * 100) < 1e-10)
const qItem = snapshot.items.find((x) => x.ticker === 'QQQM')!
assert.ok(Math.abs(qItem.relativeReturn20dPct - (Math.exp(20 * 0.002) - 1) * 100) < 1e-10)
assert.ok(Math.abs(qItem.scoreChange5dPp - (last.scorePct! - qSeries[qSeries.length - 6].scorePct!)) < 1e-10)
assert.equal(snapshot.seriesByTicker.SMH.length, dates.length)
const missingSmh = structuredClone(prices)
delete missingSmh.SMH
assert.throws(() => buildUsStyleSnapshot(missingSmh, now), /mismatch: SMH/)

const ramp = structuredClone(prices)
ramp.VYM.slice(-10).forEach((p, i) => { p.close *= 1 + i * 0.02 })
assert.equal(buildUsStyleSnapshot(ramp, now).items.find((x) => x.ticker === 'VYM')?.trend, 'up')
const weakening = structuredClone(prices)
weakening.QQQM.slice(-10).forEach((p, i) => { p.close *= 1 - i * 0.01 })
assert.equal(buildUsStyleSnapshot(weakening, now).items.find((x) => x.ticker === 'QQQM')?.trend, 'down')

const mismatch = structuredClone(prices)
mismatch.VYM.pop()
assert.throws(() => buildUsStyleSnapshot(mismatch, now), /mismatch/)
const missing = structuredClone(prices)
missing.VIG.splice(-20, 1)
assert.throws(() => buildUsStyleSnapshot(missing, now), /Missing recent session/)
const duplicate = structuredClone(prices)
duplicate.VOO.splice(-2, 0, duplicate.VOO[duplicate.VOO.length - 2])
assert.throws(() => buildUsStyleSnapshot(duplicate, now), /Invalid price/)
assert.throws(() => buildUsStyleSnapshot(prices, new Date('2026-10-20')), /Stale/)
assert.throws(() => buildUsStyleSnapshot(prices, new Date('2026-10-08T18:00:00Z')), /incomplete/)

assert.equal(newYorkDate(new Date('2026-10-09T02:00:00Z')), '2026-10-08')
const yahooPayload = { chart: { result: [{
  meta: { currency: 'USD', exchangeTimezoneName: 'America/New_York' },
  timestamp: [Date.parse('2026-10-07T13:30:00Z') / 1000, Date.parse('2026-10-08T13:30:00Z') / 1000, Date.parse('2026-10-09T13:30:00Z') / 1000],
  indicators: { adjclose: [{ adjclose: [25, 25.1, 26] }], quote: [{ close: [75, 25.1, 26] }] },
}] } }
assert.deepEqual(parseYahooAdjustedCloses(yahooPayload, '2026-10-09'), [
  { date: '2026-10-07', close: 25 }, { date: '2026-10-08', close: 25.1 },
])
assert.throws(() => parseYahooAdjustedCloses({ chart: { result: [{ meta: yahooPayload.chart.result[0].meta }] } }, '2026-10-09'), /adjusted/)

const sql = await readFile(new URL('../../supabase/migrations/0020_us_market_style.sql', import.meta.url), 'utf8')
assert.match(sql, /enable row level security/)
assert.match(sql, /revoke execute on function public.publish_us_market_style\(jsonb\) from public, anon, authenticated/)
assert.match(sql, /pg_advisory_xact_lock/)
assert.match(sql, /Refusing older US style snapshot/)
assert.match(sql, /previous_payload = us_market_style_snapshot.payload/)
const zoneHistory = Object.fromEntries(US_STYLE_TARGETS.map(({ ticker }) => [
  ticker, dates.map((date, index) => ({ date, scorePct: index - dates.length / 2 })),
]))
const zones = computeUsScoreZones(zoneHistory, '2026-10-09')
assert.ok(zones && zones.cold < 0 && zones.hot > 0)
assert.equal(zones.sampleCount, dates.length * US_STYLE_TARGETS.length)
const expectedCold = -dates.length / 2 + (dates.length - 1) * 0.1
assert.ok(Math.abs(zones.cold - expectedCold) < 1)
const withFuture = structuredClone(zoneHistory)
withFuture.VYM.push({ date: '2026-10-09', scorePct: 1000000 })
withFuture.VGT.push({ date: '2027-01-01', scorePct: -1000000 })
assert.deepEqual(computeUsScoreZones(withFuture, '2026-10-09'), zones)
assert.equal(computeUsScoreZones({}, '2026-10-09'), null)
assert.equal(computeUsScoreZones(zoneHistory, 'invalid'), null)
assert.equal(computeUsScoreZones({ ...zoneHistory, VYM: zoneHistory.VYM.slice(-100) }, '2026-10-09'), null)
const nonFinite = structuredClone(zoneHistory)
nonFinite.VYM[0].scorePct = Number.NaN
assert.equal(computeUsScoreZones(nonFinite, '2026-10-09')?.sampleCount, (dates.length - 1) * US_STYLE_TARGETS.length)
const noSmhZones = structuredClone(zoneHistory)
delete noSmhZones.SMH
assert.equal(computeUsScoreZones(noSmhZones, '2026-10-09'), null)
const highSmhZones = structuredClone(zoneHistory)
highSmhZones.SMH.forEach((p) => { p.scorePct *= 4 })
assert.ok(computeUsScoreZones(highSmhZones, '2026-10-09')!.hot > zones.hot)
assert.ok(computeUsScoreZones(highSmhZones, '2026-10-09')!.cold < zones.cold)
const smhSql = await readFile(new URL('../../supabase/migrations/0021_us_market_style_smh.sql', import.meta.url), 'utf8')
assert.match(smhSql, /'SMH'/)
assert.match(smhSql, /cardinality\(v_targets\)/)
assert.match(smhSql, /count\(distinct item->>'ticker'\)/)
assert.match(smhSql, /revoke execute .* from public, anon, authenticated/)
const vooSql = await readFile(new URL('../../supabase/migrations/0022_us_market_style_voo.sql', import.meta.url), 'utf8')
assert.match(vooSql, /benchmarkTicker' is distinct from 'VOO'/)
assert.match(vooSql, /array\['VYM', 'VIG', 'VGT', 'SCHD', 'QQQM', 'SMH'\]/)
assert.match(vooSql, /point->>'benchmarkTicker' is distinct from 'VOO'/)
assert.match(vooSql, /previous_payload = us_market_style_snapshot.payload/)
assert.match(vooSql, /revoke execute .* from public, anon, authenticated/)
const source = snapshot.seriesByTicker.SMH.map((p, i) => ({ ...p, scorePct: i }))
const percentiles = buildUsPercentileSeries(source)
assert.equal(percentiles[251].percentile, null)
assert.equal(percentiles[252].historyCount, 252)
assert.equal(percentiles[252].percentile, 100)
assert.equal(percentiles[252].historicalCold, 25.1)
assert.equal(percentiles[252].historicalHot, 225.9)
const tied = buildUsPercentileSeries(source.map((p) => ({ ...p, scorePct: 5 })))
assert.equal(tied[252].percentile, 50)
const low = structuredClone(source)
low[252].scorePct = -1
assert.equal(buildUsPercentileSeries(low)[252].percentile, 0)
const futureChanged = structuredClone(source)
futureChanged[253].scorePct = -100000
assert.deepEqual(buildUsPercentileSeries(futureChanged).slice(0, 253), percentiles.slice(0, 253))
const scaled = buildUsPercentileSeries(source.map((p) => ({ ...p, scorePct: p.scorePct * 10 + 200 })))
assert.deepEqual(scaled.map((p) => p.percentile), percentiles.map((p) => p.percentile))
const invalid = structuredClone(source)
invalid[0].scorePct = Number.NaN
assert.equal(buildUsPercentileSeries(invalid)[252].percentile, null)
assert.equal(buildUsPercentileSeries([...source].reverse())[252].percentile, 100)
const oldPoint = { ...source[0], date: '2019-01-01', scorePct: -999 }
assert.deepEqual(buildUsPercentileSeries([oldPoint, ...source]).slice(1), percentiles)
assert.deepEqual(source[252], snapshot.seriesByTicker.SMH[252] && { ...snapshot.seriesByTicker.SMH[252], scorePct: 252 })
console.log('usMarketStyle.test.ts: ok')
