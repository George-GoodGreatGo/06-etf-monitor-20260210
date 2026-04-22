import assert from 'node:assert/strict'
import {
  __buildEtfUniverseNameMapLiveCacheKeyForTest,
  __deleteRpsStyleReadCacheForTest,
  __readEtfUniverseNameMapForTest,
  __resetRpsStyleReadCacheForTest,
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
assert.equal(metadataProfile.nameSource, 'metadata')

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
  'rps:custom:v2:513310.SH:2016-01-01:2026-04-22',
)

__resetRpsStyleReadCacheForTest()
const firstNameMap = await __readEtfUniverseNameMapForTest({
  fetchEtfUniverseRows: async () => [
    { code: '513310', name: '德国ETF' },
    { code: '513999', name: 'ETF 513999' },
  ],
})

assert.equal(firstNameMap.get('513310'), '德国ETF')
assert.equal(firstNameMap.has('513999'), false)

__deleteRpsStyleReadCacheForTest(__buildEtfUniverseNameMapLiveCacheKeyForTest())
const fallbackToLastGoodMap = await __readEtfUniverseNameMapForTest({
  fetchEtfUniverseRows: async () => null,
})

assert.equal(fallbackToLastGoodMap.get('513310'), '德国ETF')

__resetRpsStyleReadCacheForTest()
const emptyFailureMap = await __readEtfUniverseNameMapForTest({
  fetchEtfUniverseRows: async () => null,
})

assert.equal(emptyFailureMap.size, 0)

__deleteRpsStyleReadCacheForTest(__buildEtfUniverseNameMapLiveCacheKeyForTest())
const recoveredMap = await __readEtfUniverseNameMapForTest({
  fetchEtfUniverseRows: async () => [{ code: '513310', name: '德国ETF' }],
})

assert.equal(recoveredMap.get('513310'), '德国ETF')
