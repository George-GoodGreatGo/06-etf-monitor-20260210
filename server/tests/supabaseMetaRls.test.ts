import assert from 'node:assert/strict'
import { readRpsStyleMeta, readValueTimingMeta } from '../lib/supabaseRest.js'

const originalFetch = globalThis.fetch
const originalSupabaseUrl = process.env.SUPABASE_URL
const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY
const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

process.env.SUPABASE_URL = 'https://example.supabase.co'

try {
  let lastApiKey = ''
  let valueTimingCalls = 0
  let rpsCalls = 0

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = new Headers(init?.headers)
    lastApiKey = headers.get('apikey') || ''

    if (url.startsWith('https://example.supabase.co/rest/v1/value_timing_meta?')) {
      valueTimingCalls += 1
      assert.ok(url.includes('id=eq.default'))
      assert.ok(url.includes('select=current_run_id,previous_run_id,history_run_ids,current_data_date,publish_status,quality_summary'))
      return new Response(
        JSON.stringify([
          {
            current_run_id: 'value-run-2',
            previous_run_id: 'value-run-1',
            history_run_ids: ['value-run-2', 'value-run-1'],
            current_data_date: '2026-05-05',
            publish_status: 'ready',
            quality_summary: { rows: 1234 },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (url.startsWith('https://example.supabase.co/rest/v1/rps_style_meta?')) {
      rpsCalls += 1
      assert.ok(url.includes('id=eq.default'))
      assert.ok(url.includes('select=current_run_id,previous_run_id,history_run_ids,current_data_date,publish_status,quality_summary'))
      return new Response(
        JSON.stringify([
          {
            current_run_id: 'rps-run-2',
            previous_run_id: 'rps-run-1',
            history_run_ids: ['rps-run-2', 'rps-run-1'],
            current_data_date: '2026-05-05',
            publish_status: 'ready',
            quality_summary: { rows: 5678 },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    throw new Error(`Unexpected URL: ${url}`)
  }) as typeof fetch

  process.env.SUPABASE_ANON_KEY = 'anon-key'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  const valueMeta = await readValueTimingMeta()
  assert.equal(lastApiKey, 'anon-key')
  assert.deepEqual(valueMeta, {
    currentRunId: 'value-run-2',
    previousRunId: 'value-run-1',
    historyRunIds: ['value-run-2', 'value-run-1'],
    currentDataDate: '2026-05-05',
    publishStatus: 'ready',
    qualitySummary: { rows: 1234 },
  })

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

  const rpsMeta = await readRpsStyleMeta()
  assert.equal(lastApiKey, 'service-role-key')
  assert.deepEqual(rpsMeta, {
    currentRunId: 'rps-run-2',
    previousRunId: 'rps-run-1',
    historyRunIds: ['rps-run-2', 'rps-run-1'],
    currentDataDate: '2026-05-05',
    publishStatus: 'ready',
    qualitySummary: { rows: 5678 },
  })

  assert.equal(valueTimingCalls, 1)
  assert.equal(rpsCalls, 1)
} finally {
  globalThis.fetch = originalFetch

  if (originalSupabaseUrl == null) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalSupabaseUrl

  if (originalSupabaseAnonKey == null) delete process.env.SUPABASE_ANON_KEY
  else process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey

  if (originalSupabaseServiceRoleKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRoleKey
}
