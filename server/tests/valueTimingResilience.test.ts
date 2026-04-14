import assert from 'node:assert/strict'
import { fetchGovBond10yYieldPctByDateSafe } from '../lib/chinamoneyGovBond.js'
import { fetchEtfProxyPeForTest } from '../lib/valueTiming.js'

process.env.CHINAMONEY_FETCH_MAX_ATTEMPTS = '1'
process.env.CHINAMONEY_FETCH_BASE_DELAY_MS = '0'
process.env.ETF_PROXY_MAX_ATTEMPTS = '1'
process.env.ETF_PROXY_BASE_DELAY_MS = '0'

const origFetch = globalThis.fetch

globalThis.fetch = (async (url: any) => {
  const u = String(url || '')
  if (u.includes('yield.chinabond.com.cn')) {
    return new Response('<html><title>504</title></html>', { status: 504, headers: { 'content-type': 'text/html' } })
  }
  if (u.includes('push2.eastmoney.com')) {
    return new Response(JSON.stringify({ data: { f162: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response('{"code":0}', { status: 200, headers: { 'content-type': 'application/json' } })
}) as any

const r1 = await fetchGovBond10yYieldPctByDateSafe({ year: 2020, cacheTtlMs: 0 })
assert.equal(r1.map.size, 0)
assert.ok(r1.error && r1.error.includes('HTTP 504'))

const r2 = await fetchEtfProxyPeForTest('159605')
assert.equal(r2.pe, null)
assert.ok(r2.error && r2.error.includes('non_positive'))

globalThis.fetch = origFetch
