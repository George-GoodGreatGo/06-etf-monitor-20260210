import { readFile } from 'node:fs/promises'
import { getRpsSignalSeries } from '../lib/rpsStyle.js'
import { MOMENTUM_STRATEGIES } from '../../src/utils/momentumStrategies.ts'
import { buildMomentumSignalsByStrategy, type MomentumSignalsByStrategy } from '../../src/utils/momentumSignalSnapshot.ts'

type CacheFile = {
  cachedAt: string
  dataDate: string
  rows: unknown
}

type TopRowLike = {
  code: string
  latestTradingDate?: string | null
  momentumSignals?: MomentumSignalsByStrategy
  [key: string]: unknown
}

function buildSignalDebugTickerSet(): Set<string> {
  const raw = String(process.env.TOP100_SIGNAL_DEBUG_TICKERS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return new Set(raw)
}

function writeSignalDebugLog(args: {
  code: string
  referenceDate: string | null
  series: Array<{ date: string; targetCloseQfq: number; scorePct: number | null }>
  momentumSignals: MomentumSignalsByStrategy
}) {
  const debugTickers = buildSignalDebugTickerSet()
  if (!debugTickers.size || !debugTickers.has(args.code)) return
  process.stdout.write(
    `${JSON.stringify(
      {
        type: 'top100_signal_debug',
        code: args.code,
        referenceDate: args.referenceDate,
        tail: args.series.slice(-12),
        momentumSignals: args.momentumSignals,
      },
      null,
      2,
    )}\n`,
  )
}

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.floor(concurrency))
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function runOne() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => runOne()))
  return results
}

async function hydrateMomentumSignals(rows: unknown[], referenceDate: string): Promise<unknown[]> {
  const candidates = rows.filter((row): row is TopRowLike => {
    if (!row || typeof row !== 'object') return false
    const code = (row as { code?: unknown }).code
    return typeof code === 'string' && code.trim().length > 0
  })
  const strategies = MOMENTUM_STRATEGIES.map((strategy) => ({
    id: strategy.id,
    signalPreset: strategy.signalPreset,
  }))
  return await mapWithConcurrency(candidates, 3, async (row) => {
    await new Promise((r) => setTimeout(r, 150))
    if (row.momentumSignals && typeof row.momentumSignals === 'object') return row
    const effectiveReferenceDate =
      typeof row.latestTradingDate === 'string' && row.latestTradingDate.trim()
        ? row.latestTradingDate.trim()
        : referenceDate
    const out = await getRpsSignalSeries({
      ticker: row.code,
      endDate: effectiveReferenceDate ?? undefined,
    })
    const momentumSignals = buildMomentumSignalsByStrategy({
      series: out.data.series,
      strategies,
      referenceDate: effectiveReferenceDate,
    })
    writeSignalDebugLog({
      code: row.code,
      referenceDate: effectiveReferenceDate,
      series: out.data.series,
      momentumSignals,
    })
    return {
      ...row,
      momentumSignals,
    }
  })
}

async function main() {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')

  const text = await readFile('server/python/.cache/top100_latest.json', 'utf-8')
  const j = JSON.parse(text) as CacheFile
  if (!j || typeof j !== 'object') throw new Error('bad cache json')
  if (!j.cachedAt || !j.dataDate || !Array.isArray(j.rows) || j.rows.length === 0) {
    throw new Error('bad cache content')
  }
  const rowsWithSignals = await hydrateMomentumSignals(j.rows, j.dataDate)

  const payload = {
    id: 1,
    fetched_at: j.cachedAt,
    data_date: j.dataDate,
    cached_at: j.cachedAt,
    source: 'akshare:sina',
    notes: [
      'Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。',
      '成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。',
      'momentum_signals=Top200 列表已写入多策略交易信号快照（当前至少含 Baseline策略 与基础颜色切换）',
    ],
    rows: rowsWithSignals,
    updated_at: new Date().toISOString(),
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/top100_latest`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write failed: HTTP ${res.status} ${body}`)
  }

  const out = await res.json().catch(() => null)
  process.stdout.write(JSON.stringify({ success: true, written: out }, null, 2))
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(msg)
  process.exit(1)
})
