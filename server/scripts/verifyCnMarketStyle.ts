import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { getCnStylePanel } from '../lib/cnMarketStyle.js'
import rpsRoutes from '../routes/rpsStyle.js'
import { CN_STYLE_TARGETS, CN_STYLE_DATA_TARGETS } from '../../src/utils/cnMarketStyle.js'

// Optional Windows transport for local Node TLS failures. Never used by the deployed server.
const originalFetch = globalThis.fetch
if (process.argv.includes('--windows-transport')) {
  assert.equal(process.platform, 'win32')
  const base = new URL(process.env.SUPABASE_URL || '')
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (new URL(url).origin !== base.origin) return originalFetch(input, init)
    assert.equal(init?.method || 'GET', 'GET', 'Verification transport is read-only')
    console.log(`Read ${new URL(url).pathname}`)
    const headers = new Headers(init?.headers)
    const script = fileURLToPath(new URL('./readSupabaseForVerification.ps1', import.meta.url))
    const out = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 55_000,
      env: { ...process.env, VERIFY_URL: url, VERIFY_API_KEY: headers.get('apikey') || '', VERIFY_AUTH: headers.get('authorization') || '' },
    })
    if (out.status !== 0 || !out.stdout.trim()) throw new Error(`Windows read transport failed: ${out.error?.message || out.stderr}`)
    return new Response(out.stdout.trim(), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}

const panel = await getCnStylePanel()
assert.equal(panel.data.benchmarkTicker, '000300')
assert.equal(panel.data.items.length, CN_STYLE_TARGETS.length)
const summary = []
for (const { ticker } of CN_STYLE_DATA_TARGETS) {
  const series = panel.data.seriesByTicker[ticker]
  assert.ok(series.length > 0, `Missing real history: ${ticker}`)
  assert.equal(new Set(series.map((p) => p.date)).size, series.length)
  assert.ok(series.every((p) => p.benchmarkTicker === '000300' && p.date <= panel.data.dataDate))
  const last = series.find((p) => p.date === panel.data.dataDate)
  const item = panel.data.items.find((p) => p.ticker === ticker) || {
    ticker, date: panel.data.dataDate, scorePct: last?.scorePct ?? null,
    percentile: last?.percentile ?? null, historyCount: last?.historyCount ?? 0,
  }
  if (last?.scorePct != null) {
    assert.ok(Math.abs(last.rpsRaw - last.targetCloseQfq / last.benchmarkCloseQfq) < 1e-12)
    const tail = series.filter((p) => p.date <= last.date).slice(-50)
    const ma = tail.reduce((sum, p) => sum + p.rpsRaw, 0) / 50
    assert.ok(Math.abs(last.rpsMa50! - ma) < 1e-12)
    assert.ok(Math.abs(last.scorePct - (last.rpsRaw / ma - 1) * 100) < 1e-8)
    assert.equal(item.scorePct, last.scorePct)
    assert.equal(item.percentile, last.percentile)
    assert.ok(item.percentile == null || item.historyCount >= 252)
    const cutoff = new Date(`${last.date}T00:00:00Z`)
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5)
    const history = series.filter((p) => p.date < last.date && p.date >= cutoff.toISOString().slice(0, 10) && p.scorePct != null)
    assert.equal(item.historyCount, history.length)
    if (item.percentile != null) {
      const rank = 100 * (history.filter((p) => p.scorePct! < last.scorePct!).length
        + 0.5 * history.filter((p) => p.scorePct === last.scorePct).length) / history.length
      assert.ok(Math.abs(item.percentile - rank) < 1e-10)
    }
  } else assert.equal(item.scorePct, null)
  summary.push({ ticker, count: series.length, start: series[0].date, end: series.at(-1)!.date, ...item })
}
console.log(JSON.stringify({ success: true, meta: panel.meta, benchmarkClose: Object.values(panel.data.seriesByTicker)[0].at(-1)?.benchmarkCloseQfq, items: summary }, null, 2))

// Isolated loopback harness mounts the real data router, not the production login flow.
if (process.argv.includes('--serve')) {
  const app = express()
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5174')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    next()
  })
  app.use('/api/rps', rpsRoutes)
  const server = app.listen(3002, '127.0.0.1', () => console.log('Read-only verification router: http://127.0.0.1:3002/api/rps/cn-panel'))
  const response = await originalFetch('http://127.0.0.1:3002/api/rps/cn-panel')
  const json = await response.json()
  assert.equal(response.status, 200)
  assert.equal(json.success, true)
  assert.deepEqual(json.data, panel.data)
  console.log('Real HTTP router verification passed')
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)))
} else {
  globalThis.fetch = originalFetch
}
