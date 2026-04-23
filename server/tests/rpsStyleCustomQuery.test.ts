import assert from 'node:assert/strict'
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
