import assert from 'node:assert/strict'
import { resolveRpsCustomTickerProfile } from '../lib/rpsStyle.js'

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
