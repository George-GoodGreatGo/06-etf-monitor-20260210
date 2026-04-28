import assert from 'node:assert/strict'
import { getRpsCustomQuery, getRpsSignalSeries, __resetRpsStyleReadCacheForTest } from '../lib/rpsStyle.js'
import { buildMomentumSignalsByStrategy } from '../../src/utils/momentumSignalSnapshot.ts'

function formatYmd(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildBusinessDates(count: number, start = '2025-04-01'): string[] {
  const out: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  while (out.length < count) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) out.push(formatYmd(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function roundTo(value: number, digits = 6): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const allDates = buildBusinessDates(320, '2025-03-01')
const endIndex = allDates.indexOf('2026-04-27')
assert.ok(endIndex > 250, 'test dates should include 2026-04-27 with enough history')
const dates = allDates.slice(0, endIndex + 1)
const buyIndex = dates.indexOf('2026-04-13')
assert.ok(buyIndex > 250, 'test dates should include 2026-04-13 after 250 bars')

const benchmarkCloses = dates.map((_, index) => {
  if (index < buyIndex - 60) return 100
  if (index < buyIndex) {
    const progress = index - (buyIndex - 60)
    return roundTo(100 + (12 * progress) / 59, 4)
  }
  return 112
})

const targetCloses = dates.map((_, index) => {
  if (index < buyIndex) return 100
  if (index === buyIndex) return 110
  return 111
})

const turnoverAmounts = dates.map((_, index) => 100_000_000 + index * 100_000)

const lowVolRows = dates.map((date, index) => ({
  run_id: 'lowvol-run-1',
  code: 'H30269',
  data_date: date,
  fetched_at: '2026-04-28T00:00:00.000Z',
  source_type: 'supabase-table',
  source: 'snapshot',
  notes: ['run_id=lowvol-run-1'],
  close: benchmarkCloses[index],
  ma60: null,
  ma250: null,
  bias60: null,
  bias250: null,
  bias_pct_3y_60: null,
  bias_pct_3y: null,
  dividend_yield_pct: null,
  yield10y_pct: null,
  spread_raw_pct: null,
  spread_smooth_pct: null,
  spread_pct: null,
  spread_pct_rank_3y: null,
  spread_pct_rank_10y: null,
  updated_at: '2026-04-28T00:00:00.000Z',
}))

const originalFetch = globalThis.fetch
const originalSupabaseUrl = process.env.SUPABASE_URL
const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY
const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

try {
  __resetRpsStyleReadCacheForTest()
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.startsWith('https://example.supabase.co/rest/v1/lowvol_meta?')) {
      return new Response(
        JSON.stringify([
          {
            current_run_id: 'lowvol-run-1',
            previous_run_id: null,
            history_run_ids: ['lowvol-run-1'],
            current_data_date: '2026-04-27',
            publish_status: 'ready',
            quality_summary: {},
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (url.startsWith('https://example.supabase.co/rest/v1/lowvol_index_point?')) {
      const parsed = new URL(url)
      const start = (parsed.searchParams.get('data_date') || '').match(/gte\.(.+)/)?.[1] ?? ''
      const end = parsed.searchParams.getAll('data_date').find((value) => value.startsWith('lte.'))?.slice(4) ?? ''
      const runId = (parsed.searchParams.get('run_id') || '').replace(/^eq\./, '')
      const rows = lowVolRows.filter((row) => {
        if (start && row.data_date < decodeURIComponent(start)) return false
        if (end && row.data_date > decodeURIComponent(end)) return false
        if (runId && row.run_id !== decodeURIComponent(runId)) return false
        return true
      })
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.startsWith('https://searchapi.eastmoney.com/api/suggest/get')) {
      return new Response(
        JSON.stringify({
          QuotationCodeTable: {
            Data: [{ Code: '513690', Name: '港股红利ETF博时' }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (url.startsWith('https://push2his.eastmoney.com/api/qt/stock/kline/get')) {
      const parsed = new URL(url)
      const fields2 = parsed.searchParams.get('fields2') || ''
      const withAmount = fields2.includes('f116')
      const klines = dates.map((date, index) => {
        const close = targetCloses[index]
        if (withAmount) return `${date},${close},${close},${close},${close},0,${turnoverAmounts[index]}`
        return `${date},${close},${close}`
      })
      return new Response(
        JSON.stringify({
          data: {
            klines,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    throw new Error(`unexpected fetch url: ${url}`)
  }) as typeof fetch

  const signalOut = await getRpsSignalSeries({
    ticker: '513690',
    startDate: dates[0],
    endDate: '2026-04-27',
  })
  const customOut = await getRpsCustomQuery({
    ticker: '513690',
    startDate: dates[0],
    endDate: '2026-04-27',
  })

  const signalSnapshots = buildMomentumSignalsByStrategy({
    series: signalOut.data.series,
    referenceDate: signalOut.meta.dataDate,
    strategies: [
      { id: 'confirmTrail12', signalPreset: 'confirmTrail12' },
      { id: 'baseColorFlip', signalPreset: 'baseColorFlip' },
    ],
  })
  const customSnapshots = buildMomentumSignalsByStrategy({
    series: customOut.data.series,
    referenceDate: customOut.meta.dataDate,
    strategies: [
      { id: 'confirmTrail12', signalPreset: 'confirmTrail12' },
      { id: 'baseColorFlip', signalPreset: 'baseColorFlip' },
    ],
  })

  assert.equal(signalOut.meta.dataDate, '2026-04-27')
  assert.equal(customOut.meta.dataDate, '2026-04-27')
  assert.ok(signalOut.meta.notes.some((note) => note.includes('benchmark_source=supabase:lowvol_index_point')))
  assert.ok(customOut.meta.notes.some((note) => note.includes('benchmark_source=supabase:lowvol_index_point')))

  assert.equal(signalSnapshots.confirmTrail12?.signalDate, '2026-04-13')
  assert.equal(signalSnapshots.confirmTrail12?.freshnessBucket, 'other')
  assert.equal(signalSnapshots.baseColorFlip?.signalDate, '2026-04-13')
  assert.deepEqual(signalSnapshots, customSnapshots)

  console.log('rpsSignalAlignment.test.ts: ok')
} finally {
  __resetRpsStyleReadCacheForTest()
  globalThis.fetch = originalFetch
  if (originalSupabaseUrl == null) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalSupabaseUrl
  if (originalSupabaseAnonKey == null) delete process.env.SUPABASE_ANON_KEY
  else process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey
  if (originalSupabaseServiceRoleKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRoleKey
}
