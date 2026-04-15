import { randomUUID } from 'node:crypto'
import { computeRpsStyleDataset, getRpsStyleSupportedTickers } from '../lib/rpsStyle.js'
import { publishRpsStyleRun, readRpsStyleMeta, type RpsStylePointRow, upsertRpsStylePoints } from '../lib/supabaseRest.js'

const FULL_BACKFILL_START = '20160101'
const RUN_HISTORY_KEEP = 5
const STALE_MAX_DAYS = 14
const SCORE_COVER_THRESHOLD = 0.9

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd8Of(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

function ymd8ToYmd10(ymd8: string): string {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function ymd10ToUtcMs(ymd10: string): number | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return Date.UTC(y, m - 1, d)
}

function diffDaysUtc(aYmd10: string, bYmd10: string): number | null {
  const a = ymd10ToUtcMs(aYmd10)
  const b = ymd10ToUtcMs(bYmd10)
  if (a == null || b == null) return null
  return Math.floor((a - b) / 86_400_000)
}

function dedupeRunIds(list: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const s = typeof raw === 'string' ? raw.trim() : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function nowBjtHour(): number {
  const ms = Date.now() + 8 * 60 * 60 * 1000
  return new Date(ms).getUTCHours()
}

function scoreCoverage(rows: Array<{ score_pct: number | null }>): number {
  if (!rows.length) return 0
  let ok = 0
  for (const r of rows) if (typeof r.score_pct === 'number' && Number.isFinite(r.score_pct)) ok += 1
  return ok / rows.length
}

function toPointRows(args: {
  runId: string
  fetchedAt: string
  source: string
  notes: string[]
  ticker: string
  rows: Array<{
    date: string
    benchmarkTicker: string
    targetCloseQfq: number
    benchmarkCloseQfq: number
    rpsRaw: number
    rpsMa50: number | null
    scorePct: number | null
  }>
}): Array<Omit<RpsStylePointRow, 'updated_at'>> {
  return args.rows.map((p) => ({
    run_id: args.runId,
    ticker: args.ticker,
    data_date: p.date,
    fetched_at: args.fetchedAt,
    source_type: 'realtime',
    source: args.source,
    notes: args.notes,
    benchmark_ticker: p.benchmarkTicker,
    target_close_qfq: p.targetCloseQfq,
    benchmark_close_qfq: p.benchmarkCloseQfq,
    rps_raw: p.rpsRaw,
    rps_ma50: p.rpsMa50,
    score_pct: p.scorePct,
  }))
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const ignoreWindow = String(process.env.RPS_REFRESH_IGNORE_WINDOW || '').trim() === '1'
  const hour = nowBjtHour()
  if (!ignoreWindow && !(hour >= 20 && hour < 22)) {
    process.stdout.write(JSON.stringify({ success: true, skipped: true, reason: 'outside_refresh_window', bjtHour: hour }, null, 2))
    return
  }

  const startDate8 = FULL_BACKFILL_START
  const endDate8 = ymd8Of(new Date())
  const endDate10 = ymd8ToYmd10(endDate8)
  if (!endDate10) throw new Error('bad endDate')

  const meta0 = await readRpsStyleMeta()
  const prevVisible = meta0?.currentRunId || null
  const runId = randomUUID()
  const fetchedAt = new Date().toISOString()
  const startedAt = Date.now()
  const tickers = getRpsStyleSupportedTickers()
  process.stdout.write(`[rps] start runId=${runId} prevVisible=${prevVisible || 'null'} tickers=${tickers.length}\n`)

  try {
    const dataset = await computeRpsStyleDataset({
      startDate: ymd8ToYmd10(startDate8),
      endDate: endDate10,
    })
    if (!dataset.dataDate) throw new Error('dataset missing dataDate')
    const lag = diffDaysUtc(endDate10, dataset.dataDate)
    if (lag != null && lag > STALE_MAX_DAYS) {
      throw new Error(`dataset stale: dataDate=${dataset.dataDate} lag=${lag}d`)
    }

    let totalRows = 0
    const qualityByTicker: Record<string, unknown> = {}
    for (const ticker of tickers) {
      const points = dataset.seriesByTicker[ticker] || []
      if (!points.length) throw new Error(`ticker empty: ${ticker}`)
      const rows = toPointRows({
        runId,
        fetchedAt,
        source: `benchmark=${dataset.benchmarkSource};target=${dataset.tickerSources[ticker]}`,
        notes: [
          'RPS=target_close_qfq/benchmark_close_qfq',
          'MA50=SMA(RPS,50)',
          'Score=(RPS/MA50-1)*100%',
          `benchmark=${dataset.benchmarkTicker}`,
        ],
        ticker,
        rows: points,
      })
      const cover = scoreCoverage(rows.slice(-504))
      qualityByTicker[ticker] = {
        rows: rows.length,
        dataDate: rows[rows.length - 1]?.data_date || null,
        scoreCoverTail: cover,
        source: dataset.tickerSources[ticker],
      }
      if (rows.length >= 200 && cover < SCORE_COVER_THRESHOLD) {
        throw new Error(`score coverage failed: ticker=${ticker} cover=${cover.toFixed(3)}`)
      }
      for (const part of chunk(rows, 250)) {
        await upsertRpsStylePoints(part)
        await sleep(120)
      }
      totalRows += rows.length
      process.stdout.write(`[rps] ticker=${ticker} rows=${rows.length} scoreCoverTail=${cover.toFixed(3)}\n`)
    }

    const historyRunIds = dedupeRunIds([runId, ...(meta0?.historyRunIds || []), prevVisible, meta0?.previousRunId]).slice(0, RUN_HISTORY_KEEP)
    const previousRunId = historyRunIds.length > 1 ? historyRunIds[1] : null
    await publishRpsStyleRun({
      nextRunId: runId,
      previousRunId,
      keepRunIds: historyRunIds,
      currentDataDate: dataset.dataDate,
      publishStatus: 'ready',
      qualitySummary: {
        mode: 'full_backfill_publish',
        startDate8,
        endDate8,
        benchmarkTicker: dataset.benchmarkTicker,
        benchmarkSource: dataset.benchmarkSource,
        totalRows,
        dataDate: dataset.dataDate,
        qualityByTicker,
      },
    })

    const ms = Date.now() - startedAt
    process.stdout.write(JSON.stringify({ success: true, runId, prevVisible, published: true, keepRuns: historyRunIds, totalRows, dataDate: dataset.dataDate, ms }, null, 2))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    process.stderr.write(`[rps] failed runId=${runId} err=${msg}\n`)
    if (prevVisible) {
      const fallbackHistory = dedupeRunIds([...(meta0?.historyRunIds || []), prevVisible]).slice(0, RUN_HISTORY_KEEP)
      await publishRpsStyleRun({
        nextRunId: prevVisible,
        previousRunId: fallbackHistory.length > 1 ? fallbackHistory[1] : null,
        keepRunIds: fallbackHistory,
        currentDataDate: meta0?.currentDataDate || null,
        publishStatus: 'failed',
        qualitySummary: {
          failedRunId: runId,
          error: msg,
          errorContext: {
            benchmarkTicker: '512890.SH',
            phase: 'compute_or_publish',
          },
          failedAt: new Date().toISOString(),
        },
      })
      process.stdout.write(
        JSON.stringify(
          {
            success: true,
            published: false,
            fallbackRunId: prevVisible,
            reason: msg,
          },
          null,
          2,
        ),
      )
      return
    }
    throw e
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack || e.message : String(e)}\n`)
  process.exit(1)
})
