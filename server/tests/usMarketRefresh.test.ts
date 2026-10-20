import assert from 'node:assert/strict'
import express from 'express'
import { readFile } from 'node:fs/promises'
import router from '../routes/usMarketStyle.js'
import { decodeRefreshTicket } from '../lib/usMarketRefresh.js'
import { US_STYLE_TARGETS } from '../../src/utils/usMarketStyle.js'

const originalFetch = globalThis.fetch
const savedEnv = { ...process.env }
Object.assign(process.env, { GITHUB_ACTIONS_TOKEN: 'test-only', GITHUB_OWNER: 'owner',
  GITHUB_REPO: 'repo', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' })
let state = 'queued'
let conclusion = 'success'
let requestId = ''
let dispatchCount = 0
const snapshot = {
  version: 1, benchmarkTicker: 'VOO', dataDate: '2026-10-19', fetchedAt: '2026-10-19T06:35:00Z',
  items: US_STYLE_TARGETS.map(({ ticker }) => ({ ticker })),
  seriesByTicker: Object.fromEntries(US_STYLE_TARGETS.map(({ ticker }) => [
    ticker, Array.from({ length: 252 }, () => ({ ticker, benchmarkTicker: 'VOO' })),
  ])),
}
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.includes('/dispatches')) {
    dispatchCount++
    const body = JSON.parse(String(init?.body))
    assert.equal(body.ref, process.env.GITHUB_REF || 'main')
    requestId = body.inputs.request_id
    return new Response(null, { status: 204 })
  }
  if (url.includes('/runs?')) return Response.json({ workflow_runs: state === 'queued' ? [] : [{
    id: 1, display_title: `US market style ${requestId}`,
    status: state, conclusion, html_url: 'https://github.com/owner/repo/actions/runs/1',
  }, { id: 2, display_title: 'US market style unrelated', status: 'completed', conclusion: 'success' }] })
  if (url.includes('/rest/v1/')) return Response.json([{ payload: snapshot }])
  throw new Error(`Unexpected external request: ${url}`)
}
const app = express()
app.use(express.json())
app.use('/api/us-market-style', router)
const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve) => server.once('listening', resolve))
const address = server.address() as { port: number }
const base = `http://127.0.0.1:${address.port}/api/us-market-style`
const post = () => originalFetch(`${base}/refresh`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
})
try {
  delete process.env.GITHUB_ACTIONS_TOKEN
  assert.equal((await post()).status, 503)
  process.env.GITHUB_ACTIONS_TOKEN = 'test-only'
  const crossSite = await originalFetch(`${base}/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example',
      'Sec-Fetch-Site': 'cross-site' }, body: '{}',
  })
  assert.equal(crossSite.status, 403)
  assert.equal(dispatchCount, 0)
  const response = await post()
  assert.equal(response.status, 202)
  const ticket = (await response.json()).data.ticket as string
  assert.equal((await (await post()).json()).data.ticket, ticket)
  assert.equal(dispatchCount, 1)
  const status = async () => (await (await originalFetch(`${base}/refresh/status?ticket=${encodeURIComponent(ticket)}`)).json()).data
  assert.equal((await status()).state, 'queued')
  state = 'in_progress'
  assert.equal((await status()).state, 'running')
  state = 'completed'
  conclusion = 'failure'
  assert.equal((await status()).state, 'failed')
  conclusion = 'success'
  assert.equal((await status()).state, 'publishing')
  snapshot.fetchedAt = new Date(Date.now() + 1000).toISOString()
  const done = await status()
  assert.equal(done.state, 'success')
  assert.equal(done.snapshot.benchmarkTicker, 'VOO')
  assert.equal(done.snapshot.dataDate, '2026-10-19')
  snapshot.benchmarkTicker = 'SCHD'
  assert.equal((await status()).state, 'publishing')
  assert.throws(() => decodeRefreshTicket(`${ticket}x`), /无效/)
  assert.equal((await originalFetch(`${base}/refresh/status?ticket=bad`)).status, 400)
  const workflow = await readFile(new URL('../../.github/workflows/refresh-us-market-style.yml', import.meta.url), 'utf8')
  assert.match(workflow, /run-name: US market style/)
  assert.match(workflow, /request_id:/)
  const page = await readFile(new URL('../../src/pages/UsMarketStyle.tsx', import.meta.url), 'utf8')
  assert.match(page, /x.ticker === 'VYM' \|\| x.ticker === 'VGT'/)
  const appSource = await readFile(new URL('../app.ts', import.meta.url), 'utf8')
  assert.match(appSource, /app.use\('\/api\/us-market-style', requireAuthenticatedAccess, usMarketStyleRoutes\)/)
  console.log('usMarketRefresh.test.ts: ok')
} finally {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]
  Object.assign(process.env, savedEnv)
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
