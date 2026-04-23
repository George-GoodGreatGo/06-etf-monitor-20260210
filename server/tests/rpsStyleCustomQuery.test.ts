import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  __buildEtfNameHttpCacheKeyForTest,
  __clipSeriesToInclusiveEndDateForTest,
  __deleteRpsStyleReadCacheForTest,
  __fetchEtfNameByEastmoneySuggestForTest,
  __pickEtfNameFromEastmoneySuggestPayloadForTest,
  __resolveLatestCompleteTradingDateForTest,
  __resolveSharedLatestCompleteTradingDateForTest,
  __resetRpsStyleReadCacheForTest,
  buildRpsLatestTurnoverSummary,
  buildRpsCustomQueryCacheKey,
  resolveRpsCustomTickerProfile,
} from '../lib/rpsStyle.js'
import {
  __mergeRpsCustomRecentSearchesForTest,
  __normalizeStoredRpsCustomRecentSearchItemsForTest,
  listRpsCustomRecentSearches,
  recordRpsCustomRecentSearch,
} from '../lib/rpsRecentSearches.js'

let presetLookupCalls = 0
const presetProfile = await resolveRpsCustomTickerProfile('159915', {
  resolveEtfNameByCode: async () => {
    presetLookupCalls += 1
    return '不应命中'
  },
})

assert.equal(presetProfile.ticker, '159915.SZ')
assert.equal(presetProfile.code, '159915')
assert.equal(presetProfile.name, '创业板ETF')
assert.equal(presetProfile.nameSource, 'preset')
assert.equal(presetLookupCalls, 0)

const metadataProfile = await resolveRpsCustomTickerProfile('513310', {
  resolveEtfNameByCode: async (code) => {
    assert.equal(code, '513310')
    return '德国ETF'
  },
})

assert.equal(metadataProfile.ticker, '513310.SH')
assert.equal(metadataProfile.code, '513310')
assert.equal(metadataProfile.name, '德国ETF')
assert.equal(metadataProfile.nameSource, 'eastmoney_http')

const fallbackProfile = await resolveRpsCustomTickerProfile('513999.SH', {
  resolveEtfNameByCode: async (code) => {
    assert.equal(code, '513999')
    return 'ETF 513999'
  },
})

assert.equal(fallbackProfile.ticker, '513999.SH')
assert.equal(fallbackProfile.code, '513999')
assert.equal(fallbackProfile.name, '513999')
assert.equal(fallbackProfile.nameSource, 'fallback_code')

assert.equal(
  buildRpsCustomQueryCacheKey('513310.SH', '2016-01-01', '2026-04-22'),
  'rps:custom:v5:513310.SH:2016-01-01:2026-04-22',
)

const turnoverHistory = Array.from({ length: 91 }, (_, index) => ({
  date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  turnover: index < 90 ? 100 + index : 250,
  turnoverMultipleOfPrev20Avg: index < 20 ? null : 1.1,
}))
const turnoverSummary = buildRpsLatestTurnoverSummary(turnoverHistory)
assert.ok(turnoverSummary)
assert.equal(turnoverSummary?.date, '2026-01-91')
assert.equal(turnoverSummary?.turnover, 250)
assert.equal(turnoverSummary?.turnoverChangePct1d, 32.28)
assert.equal(turnoverSummary?.turnoverChangePct7dAvg, 34.41)
assert.equal(turnoverSummary?.dataStatus, 'complete')
assert.ok(typeof turnoverSummary?.z90 === 'number' && Number.isFinite(turnoverSummary.z90))

assert.equal(
  __resolveLatestCompleteTradingDateForTest(
    ['2026-04-21', '2026-04-22', '2026-04-23'],
    new Date('2026-04-23T06:30:00Z'),
  ),
  '2026-04-22',
)
assert.equal(
  __resolveLatestCompleteTradingDateForTest(
    ['2026-04-21', '2026-04-22', '2026-04-23'],
    new Date('2026-04-23T08:30:00Z'),
  ),
  '2026-04-23',
)
assert.equal(
  __resolveSharedLatestCompleteTradingDateForTest({
    rpsSeries: [{ date: '2026-04-21' }, { date: '2026-04-22' }, { date: '2026-04-23' }],
    turnoverSeries: [{ date: '2026-04-18' }, { date: '2026-04-22' }],
    now: new Date('2026-04-23T06:30:00Z'),
  }),
  '2026-04-22',
)
assert.deepEqual(
  __clipSeriesToInclusiveEndDateForTest(
    [
      { date: '2026-04-21', value: 'a' },
      { date: '2026-04-22', value: 'b' },
      { date: '2026-04-23', value: 'c' },
    ],
    '2026-04-22',
  ),
  [
    { date: '2026-04-21', value: 'a' },
    { date: '2026-04-22', value: 'b' },
  ],
)

const incompleteTurnoverSummary = buildRpsLatestTurnoverSummary([
  { date: '2026-04-21', turnover: 100, turnoverMultipleOfPrev20Avg: null },
  { date: '2026-04-22', turnover: 120, turnoverMultipleOfPrev20Avg: 1.2 },
])
assert.deepEqual(incompleteTurnoverSummary, {
  date: '2026-04-22',
  turnover: 120,
  turnoverMultipleOfPrev20Avg: 1.2,
  turnoverChangePct1d: 20,
  turnoverChangePct7dAvg: null,
  z90: null,
  dataStatus: 'incomplete',
})

assert.equal(
  __pickEtfNameFromEastmoneySuggestPayloadForTest(
    {
      QuotationCodeTable: {
        Data: [
          { Code: '159985', Name: '豆粕ETF华夏' },
          { Code: '513999', Name: 'ETF 513999' },
        ],
      },
    },
    '159985',
  ),
  '豆粕ETF华夏',
)
assert.equal(
  __pickEtfNameFromEastmoneySuggestPayloadForTest(
    {
      QuotationCodeTable: {
        Data: [{ Code: '513999', Name: 'ETF 513999' }],
      },
    },
    '513999',
  ),
  null,
)

let eastmoneyFetchCalls = 0
const eastmoneyName = await __fetchEtfNameByEastmoneySuggestForTest('159209', {
  fetchImpl: async () => {
    eastmoneyFetchCalls += 1
    return new Response(
      JSON.stringify({
        QuotationCodeTable: {
          Data: [
            { Code: '159209', Name: '红利质量ETF招商' },
            { Code: '513310', Name: '中韩半导体ETF华泰柏瑞' },
          ],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  },
})

assert.equal(eastmoneyName, '红利质量ETF招商')
assert.equal(eastmoneyFetchCalls, 1)

__resetRpsStyleReadCacheForTest()
__deleteRpsStyleReadCacheForTest(__buildEtfNameHttpCacheKeyForTest('159209'))

const originalVercel = process.env.VERCEL
process.env.VERCEL = '1'

try {
  let vercelLookupCalls = 0
  const vercelStaticProfile = await resolveRpsCustomTickerProfile('159209', {
    resolveEtfNameByCode: async (code) => {
      vercelLookupCalls += 1
      assert.equal(code, '159209')
      return '红利质量ETF招商'
    },
  })
  assert.equal(vercelStaticProfile.ticker, '159209.SZ')
  assert.equal(vercelStaticProfile.code, '159209')
  assert.equal(vercelStaticProfile.name, '红利质量ETF招商')
  assert.equal(vercelStaticProfile.nameSource, 'eastmoney_http')
  assert.equal(vercelLookupCalls, 1)

  const vercelStaticProfile2 = await resolveRpsCustomTickerProfile('159985', {
    resolveEtfNameByCode: async (code) => {
      assert.equal(code, '159985')
      return '豆粕ETF华夏'
    },
  })
  assert.equal(vercelStaticProfile2.ticker, '159985.SZ')
  assert.equal(vercelStaticProfile2.code, '159985')
  assert.equal(vercelStaticProfile2.name, '豆粕ETF华夏')
  assert.equal(vercelStaticProfile2.nameSource, 'eastmoney_http')
} finally {
  if (originalVercel == null) delete process.env.VERCEL
  else process.env.VERCEL = originalVercel
}

const mergedRecent = __mergeRpsCustomRecentSearchesForTest(
  [
    { ticker: '510300.SH', code: '510300', name: '沪深300ETF', updatedAt: '2026-04-22T10:00:00.000Z' },
    { ticker: '159915.SZ', code: '159915', name: '创业板ETF', updatedAt: '2026-04-21T10:00:00.000Z' },
  ],
  { ticker: '159915.SZ', code: '159915', name: '创业板ETF' },
  new Date('2026-04-23T10:00:00.000Z'),
)
assert.deepEqual(
  mergedRecent.map((item) => item.ticker),
  ['159915.SZ', '510300.SH'],
)
assert.equal(mergedRecent[0]?.updatedAt, '2026-04-23T10:00:00.000Z')

const limitedRecent = Array.from({ length: 12 }, (_, index) => ({
  ticker: `${String(510000 + index)}.SH`,
  code: String(510000 + index),
  name: '',
}))
  .reduce(
    (items, item, index) =>
      __mergeRpsCustomRecentSearchesForTest(items, item, new Date(`2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`)),
    [] as Array<{ ticker: string; code: string; name: string; updatedAt: string }>,
  )
assert.equal(limitedRecent.length, 10)
assert.equal(limitedRecent[0]?.ticker, '510011.SH')
assert.equal(limitedRecent[9]?.ticker, '510002.SH')

assert.deepEqual(
  __normalizeStoredRpsCustomRecentSearchItemsForTest([
    { ticker: '513310.sh', code: '513310', name: '', updatedAt: '2026-04-20T00:00:00.000Z' },
    { ticker: '513310.SH', code: '513310', name: '德国ETF', updatedAt: '2026-04-21T00:00:00.000Z' },
    { ticker: '', code: '000000', name: 'bad', updatedAt: '2026-04-22T00:00:00.000Z' },
  ]),
  [{ ticker: '513310.SH', code: '513310', name: '德国ETF', updatedAt: '2026-04-21T00:00:00.000Z' }],
)

const originalRecentSearchesFile = process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE
const recentSearchesTestFile = fileURLToPath(
  new URL('../tmp/rps-custom-query-recent-searches.test.json', import.meta.url),
)
process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE = recentSearchesTestFile

try {
  await rm(recentSearchesTestFile, { force: true })
  const userA = 'alice@example.com'
  const userB = 'bob@example.com'
  for (let index = 0; index < 11; index += 1) {
    await recordRpsCustomRecentSearch(userA, {
      ticker: `${String(159900 + index)}.SZ`,
      code: String(159900 + index),
      name: '',
    })
  }
  await recordRpsCustomRecentSearch(userA, {
    ticker: '159905.SZ',
    code: '159905',
    name: '重排ETF',
  })
  await recordRpsCustomRecentSearch(userB, {
    ticker: '510300.SH',
    code: '510300',
    name: '沪深300ETF',
  })

  const userARecent = await listRpsCustomRecentSearches(userA)
  const userBRecent = await listRpsCustomRecentSearches(userB)
  assert.equal(userARecent.length, 10)
  assert.equal(userARecent[0]?.ticker, '159905.SZ')
  assert.equal(userARecent[0]?.name, '重排ETF')
  assert.ok(!userARecent.some((item) => item.ticker === '159900.SZ'))
  assert.deepEqual(
    userBRecent.map((item) => item.ticker),
    ['510300.SH'],
  )
} finally {
  await rm(recentSearchesTestFile, { force: true })
  if (originalRecentSearchesFile == null) delete process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE
  else process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE = originalRecentSearchesFile
}

const originalSupabaseUrl = process.env.SUPABASE_URL
const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const originalFetch = globalThis.fetch
delete process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE
process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

try {
  type MockRecentRow = { user_key: string; ticker: string; code: string; name: string; updated_at: string }
  const supabaseRows = new Map<string, MockRecentRow[]>()
  let callSeq = 0

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url === 'https://example.supabase.co/rest/v1/rpc/upsert_rps_custom_recent_search') {
      const payload = JSON.parse(String(init?.body || '{}')) as {
        p_user_key?: string
        p_ticker?: string
        p_code?: string
        p_name?: string
        p_limit?: number
      }
      const userKey = String(payload.p_user_key || '').trim().toLowerCase()
      const ticker = String(payload.p_ticker || '').trim().toUpperCase()
      const code = String(payload.p_code || '').trim() || ticker.split('.')[0] || ticker
      const name = String(payload.p_name || '').trim() || code
      const limit = Math.max(1, Math.floor(Number(payload.p_limit) || 10))
      const updatedAt = new Date(Date.UTC(2026, 3, 1, 0, 0, callSeq)).toISOString()
      callSeq += 1
      const current = supabaseRows.get(userKey) || []
      const next = [
        { user_key: userKey, ticker, code, name, updated_at: updatedAt },
        ...current.filter((item) => item.ticker !== ticker),
      ]
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.ticker.localeCompare(b.ticker))
        .slice(0, limit)
      supabaseRows.set(userKey, next)
      return new Response(null, { status: 204 })
    }
    if (url.startsWith('https://example.supabase.co/rest/v1/rps_custom_recent_search?')) {
      const parsed = new URL(url)
      const userKey = (parsed.searchParams.get('user_key') || '').replace(/^eq\./, '').toLowerCase()
      const rows = (supabaseRows.get(userKey) || []).map((item) => ({
        ticker: item.ticker,
        code: item.code,
        name: item.name,
        updated_at: item.updated_at,
      }))
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`unexpected fetch url: ${url}`)
  }) as typeof fetch

  const userA = 'alice@example.com'
  const userB = 'bob@example.com'
  for (let index = 0; index < 11; index += 1) {
    await recordRpsCustomRecentSearch(userA, {
      ticker: `${String(510100 + index)}.SH`,
      code: String(510100 + index),
      name: '',
    })
  }
  await recordRpsCustomRecentSearch(userA, {
    ticker: '510105.SH',
    code: '510105',
    name: '重排ETF',
  })
  await recordRpsCustomRecentSearch(userB, {
    ticker: '159915.SZ',
    code: '159915',
    name: '创业板ETF',
  })

  const userARecent = await listRpsCustomRecentSearches(userA)
  const userBRecent = await listRpsCustomRecentSearches(userB)
  assert.equal(userARecent.length, 10)
  assert.equal(userARecent[0]?.ticker, '510105.SH')
  assert.equal(userARecent[0]?.name, '重排ETF')
  assert.ok(!userARecent.some((item) => item.ticker === '510100.SH'))
  assert.deepEqual(
    userBRecent.map((item) => item.ticker),
    ['159915.SZ'],
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalSupabaseUrl == null) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalSupabaseUrl
  if (originalSupabaseServiceRoleKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRoleKey
}
