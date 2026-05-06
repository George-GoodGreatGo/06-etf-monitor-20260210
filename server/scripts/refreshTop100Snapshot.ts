import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { ensureTop100Insight } from '../lib/top100Insight.js'
import { getRpsSignalSeries } from '../lib/rpsStyle.js'
import { MOMENTUM_STRATEGIES } from '../../src/utils/momentumStrategies.ts'
import { buildMomentumSignalsByStrategy, type MomentumSignalsByStrategy } from '../../src/utils/momentumSignalSnapshot.ts'

const execFileAsync = promisify(execFile)

type AkshareOk<T> = {
  success: true
  meta: {
    fetchedAt: string
    dataDate: string
    source?: string
    notes?: string[]
  }
  data: T
}

type AkshareErr = {
  success: false
  error: string
  message: string
}

type AkshareResp<T> = AkshareOk<T> | AkshareErr

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
  series: Array<{ date: string; targetCloseQfq: number; benchmarkCloseQfq: number; rpsRaw: number; rpsMa50: number | null; scorePct: number | null }>
  momentumSignals: MomentumSignalsByStrategy
}) {
  const debugTickers = buildSignalDebugTickerSet()
  if (!debugTickers.size || !debugTickers.has(args.code)) return
  // Slice 55 days to cover the full MA50 window + 5 extra for safety
  const tail55 = args.series.slice(-55)
  // Also capture the MA50 of the last point for direct comparison
  const last = tail55.length ? tail55[tail55.length - 1] : null
  process.stdout.write(
    `${JSON.stringify(
      {
        type: 'top100_signal_debug',
        code: args.code,
        referenceDate: args.referenceDate,
        tailLen: tail55.length,
        lastMa50: last?.rpsMa50 ?? null,
        lastScorePct: last?.scorePct ?? null,
        tail: tail55,
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

function guessPythonBin(): string {
  return String(
    process.env.AKSHARE_PYTHON_BIN ||
      process.env.PYTHON_BIN ||
      (process.platform === 'win32' ? 'python' : 'python3'),
  )
}

async function computeTop100(limit: number): Promise<AkshareOk<unknown[]>> {
  const bin = guessPythonBin()
  const script = path.resolve('server/python/akshare_service.py')
  const { stdout } = await execFileAsync(
    bin,
    [script, 'top100', '--limit', String(limit), '--refresh', '--ensure-latest'],
    {
      timeout: 20 * 60_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    },
  )

  const text = String(stdout || '').trim()
  const j = (text ? (JSON.parse(text) as unknown) : null) as AkshareResp<unknown>
  if (!j || typeof j !== 'object') throw new Error('AkShare 返回为空')
  if ((j as AkshareErr).success === false) {
    const e = j as AkshareErr
    throw new Error(e.message || e.error || 'AkShare 调用失败')
  }
  const ok = j as AkshareOk<unknown>
  if (!Array.isArray(ok.data)) throw new Error('AkShare 返回数据结构异常')
  return ok as AkshareOk<unknown[]>
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

async function hydrateMomentumSignals(rows: unknown[]): Promise<unknown[]> {
  const candidates = rows.filter((row): row is TopRowLike => {
    if (!row || typeof row !== 'object') return false
    const code = (row as { code?: unknown }).code
    return typeof code === 'string' && code.trim().length > 0
  })
  const strategies = MOMENTUM_STRATEGIES.map((strategy) => ({
    id: strategy.id,
    signalPreset: strategy.signalPreset,
  }))
  const hydrated = await mapWithConcurrency(candidates, 6, async (row) => {
    const code = String(row.code || '').trim()
    const referenceDate =
      typeof row.latestTradingDate === 'string' && row.latestTradingDate.trim()
        ? row.latestTradingDate.trim()
        : null
    const out = await getRpsSignalSeries({ ticker: code, endDate: referenceDate ?? undefined })
    const momentumSignals = buildMomentumSignalsByStrategy({
      series: out.data.series,
      strategies,
      referenceDate,
    })
    writeSignalDebugLog({
      code,
      referenceDate,
      series: out.data.series,
      momentumSignals,
    })
    return {
      ...row,
      momentumSignals,
    }
  })
  return hydrated
}

async function upsertToSupabase(ok: AkshareOk<unknown[]>) {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')

  const payload = {
    id: 1,
    fetched_at: ok.meta.fetchedAt,
    data_date: ok.meta.dataDate,
    cached_at: ok.meta.fetchedAt,
    source: ok.meta.source || 'akshare:sina',
    notes: ok.meta.notes || [],
    rows: ok.data,
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

  return (await res.json().catch(() => null)) as unknown
}

async function main() {
  const limit = Number.parseInt(String(process.env.TOP100_LIMIT || '200'), 10) || 200
  const ok = await computeTop100(Math.max(1, Math.min(200, limit)))

  const maxLatestTradingDate = (ok.data as TopRowLike[])
    .map((r) => (typeof r.latestTradingDate === 'string' ? r.latestTradingDate.trim() : ''))
    .filter(Boolean)
    .sort()
    .pop()
  if (maxLatestTradingDate) {
    const { getLowVolIndexSnapshotSeries } = await import('../lib/lowVol.js')
    try {
      const benchmarkCheck = await getLowVolIndexSnapshotSeries({
        code: 'H30269',
        startDate: maxLatestTradingDate,
        endDate: maxLatestTradingDate,
      })
      const benchmarkLatest = benchmarkCheck.data.series.map((s) => s.date).sort().pop()
      if (benchmarkLatest && benchmarkLatest < maxLatestTradingDate) {
        process.stdout.write(
          `[top100] skip: H30269基准数据滞后（H30269=${benchmarkLatest} < ETF=${maxLatestTradingDate}），跳过本次运行\n`,
        )
        process.exit(0)
      }
    } catch {
      process.stdout.write(
        `[top100] skip: H30269基准数据不可用（无${maxLatestTradingDate}数据），跳过本次运行\n`,
      )
      process.exit(0)
    }
  }

  // 等待 Supabase 读副本同步：lowvol 发布后，Postgres 异步复制可能延迟，
  // 立即读取 lowvol_index_point 可能拿到混合了旧值的数据，导致 MA50 偏移。
  await new Promise((r) => setTimeout(r, 3000))

  const rowsWithSignals = await hydrateMomentumSignals(ok.data)
  const enriched: AkshareOk<unknown[]> = {
    ...ok,
    meta: {
      ...ok.meta,
      notes: [
        ...(ok.meta.notes || []),
        'momentum_signals=Top200 列表已写入多策略交易信号快照（当前至少含 Baseline策略 与基础颜色切换）',
      ],
    },
    data: rowsWithSignals,
  }
  const written = await upsertToSupabase(enriched)
  await ensureTop100Insight(
    enriched.meta.dataDate,
    enriched.meta.fetchedAt,
    enriched.meta.source || 'akshare:sina',
    enriched.data,
  ).catch((e) => {
    process.stderr.write(`ensureTop100Insight failed: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  process.stdout.write(JSON.stringify({ success: true, meta: enriched.meta, written }, null, 2))
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(msg)
  process.exit(1)
})
