import { randomUUID } from 'node:crypto'
import { getLowVolIndexSeries, getLowVolSupportedIndexCodes, type LowVolDailyPoint } from '../lib/lowVol.js'
import { publishLowVolRun, readLowVolMeta, type LowVolIndexPointRow, upsertLowVolIndexPoints } from '../lib/supabaseRest.js'

const FULL_BACKFILL_START = '20160101'
const RUN_HISTORY_KEEP = 5
const COVERAGE_THRESHOLD = 0.95
const STALE_MAX_DAYS = 14

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

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
  const ms = Date.UTC(y, m - 1, d)
  return Number.isFinite(ms) ? ms : null
}

function diffDaysUtc(aYmd10: string, bYmd10: string): number | null {
  const a = ymd10ToUtcMs(aYmd10)
  const b = ymd10ToUtcMs(bYmd10)
  if (a == null || b == null) return null
  return Math.floor((a - b) / 86_400_000)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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

function withJitter(base: number, extra: number): number {
  return Math.max(0, base + Math.floor(Math.random() * Math.max(1, extra)))
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries: number): Promise<T> {
  let lastErr: unknown = null
  for (let i = 0; i <= maxRetries; i += 1) {
    try {
      if (i > 0) await sleep(withJitter(600 * i, 800))
      return await fn()
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      process.stderr.write(`[retry] ${label} attempt=${i}/${maxRetries} err=${msg}\n`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function coverageRatio<T extends object>(rows: T[], key: keyof T): number {
  if (!rows.length) return 0
  let ok = 0
  for (const r of rows) {
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v)) ok += 1
  }
  return ok / rows.length
}

function summarizeCoverage(series: LowVolDailyPoint[]) {
  const tail = series.slice(-504)
  return {
    window: tail.length,
    closeCover: coverageRatio(tail, 'close'),
    dividendCover: coverageRatio(tail, 'dividendYieldPct'),
    spreadCover: coverageRatio(tail, 'spreadPct'),
    spreadRankCover: coverageRatio(tail, 'spreadPctRank10y'),
    biasCover: coverageRatio(tail, 'biasPct3y'),
  }
}

function mapSeriesToPointRows(args: {
  runId: string
  code: string
  fetchedAt: string
  source: string | null
  notes: string[]
  series: LowVolDailyPoint[]
}): Array<Omit<LowVolIndexPointRow, 'updated_at'>> {
  const { runId, code, fetchedAt, source, notes, series } = args
  return series.map((p) => ({
    run_id: runId,
    code,
    data_date: p.date,
    fetched_at: fetchedAt,
    source_type: 'realtime',
    source,
    notes,
    close: p.close,
    ma60: p.ma60 ?? null,
    ma250: p.ma250 ?? null,
    bias60: p.bias60 ?? null,
    bias250: p.bias250 ?? null,
    bias_pct_3y_60: p.biasPct3y60 ?? null,
    bias_pct_3y: p.biasPct3y ?? null,
    dividend_yield_pct: p.dividendYieldPct ?? null,
    yield10y_pct: p.yield10yPct ?? null,
    spread_raw_pct: p.spreadRawPct ?? null,
    spread_smooth_pct: p.spreadSmoothPct ?? null,
    spread_pct: p.spreadPct ?? null,
    spread_pct_rank_3y: p.spreadPctRank3y ?? null,
    spread_pct_rank_10y: p.spreadPctRank10y ?? null,
  }))
}

function isWafError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('csindex blocked by WAF') || msg.includes('熔断中')
}

function logEvent(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

async function main() {
  const startDate8 = FULL_BACKFILL_START
  const endDate8 = ymd8Of(new Date())
  const endDate10 = ymd8ToYmd10(endDate8)
  if (!endDate10) throw new Error('bad endDate')
  const codes = getLowVolSupportedIndexCodes()
  const meta0 = await readLowVolMeta()
  const prevVisible = meta0?.currentRunId || null
  const runId = randomUUID()
  const startedAt = Date.now()
  const perCode: Record<string, unknown> = {}

  logEvent({ type: 'start', mode: 'full_backfill_publish', runId, prevVisible, startDate8, endDate8, codes: codes.length })

  try {
    let maxDataDate: string | null = null
    let totalRows = 0
    for (let idx = 0; idx < codes.length; idx += 1) {
      const code = codes[idx]
      const t0 = Date.now()
      logEvent({ type: 'index_start', idx: idx + 1, total: codes.length, code, runId })

      const out = await withRetry(
        () => getLowVolIndexSeries({ code, startDate: startDate8, endDate: endDate8 }),
        `compute lowvol ${code}`,
        2,
      )
      const series = out.data?.series ?? []
      if (!series.length) throw new Error(`empty series: ${code}`)
      const last = series[series.length - 1]
      const lag = diffDaysUtc(endDate10, last.date)
      if (lag != null && lag > STALE_MAX_DAYS) {
        throw new Error(`series stale: code=${code} last=${last.date} lag=${lag}d`)
      }

      const cov = summarizeCoverage(series)
      if (
        cov.window >= 200 &&
        (cov.closeCover < COVERAGE_THRESHOLD ||
          cov.dividendCover < COVERAGE_THRESHOLD ||
          cov.spreadCover < COVERAGE_THRESHOLD ||
          cov.spreadRankCover < COVERAGE_THRESHOLD ||
          cov.biasCover < COVERAGE_THRESHOLD)
      ) {
        throw new Error(
          `coverage failed: code=${code} close=${cov.closeCover.toFixed(3)} dividend=${cov.dividendCover.toFixed(3)} spread=${cov.spreadCover.toFixed(3)} spreadRank=${cov.spreadRankCover.toFixed(3)} bias=${cov.biasCover.toFixed(3)}`,
        )
      }

      const pointRows = mapSeriesToPointRows({
        runId,
        code,
        fetchedAt: out.meta.fetchedAt || new Date().toISOString(),
        source: out.meta.source || null,
        notes: Array.isArray(out.meta.notes) ? out.meta.notes : [],
        series,
      })
      for (const part of chunk(pointRows, 200)) {
        await withRetry(() => upsertLowVolIndexPoints(part), `upsert lowvol points code=${code} size=${part.length}`, 3)
        await sleep(withJitter(250, 450))
      }
      totalRows += pointRows.length
      if (!maxDataDate || last.date > maxDataDate) maxDataDate = last.date
      perCode[code] = {
        rows: pointRows.length,
        dataDate: last.date,
        lagDays: lag,
        coverage: cov,
      }
      logEvent({ type: 'index_done', idx: idx + 1, total: codes.length, code, ok: true, rows: pointRows.length, dataDate: last.date, lagDays: lag, ms: Date.now() - t0 })
      await sleep(withJitter(350, 500))
    }

    if (!maxDataDate) throw new Error('missing maxDataDate')
    const historyRunIds = dedupeRunIds([runId, ...(meta0?.historyRunIds || []), prevVisible, meta0?.previousRunId]).slice(0, RUN_HISTORY_KEEP)
    const previousRunId = historyRunIds.length > 1 ? historyRunIds[1] : null
    const qualitySummary = {
      mode: 'full_backfill_publish',
      startDate8,
      endDate8,
      totalRows,
      maxDataDate,
      maxStaleDays: STALE_MAX_DAYS,
      coverageThreshold: COVERAGE_THRESHOLD,
      perCode,
    }
    await withRetry(
      () =>
        publishLowVolRun({
          nextRunId: runId,
          previousRunId,
          keepRunIds: historyRunIds,
          currentDataDate: maxDataDate,
          publishStatus: 'ready',
          qualitySummary,
        }),
      'publish lowvol run atomically',
      3,
    )
    const ms = Date.now() - startedAt
    logEvent({ type: 'finish', published: true, runId, prevVisible, keepRuns: historyRunIds, maxDataDate, totalRows, ms })
    process.stdout.write(JSON.stringify({ success: true, runId, prevVisible, published: true, keepRuns: historyRunIds, maxDataDate, totalRows, ms }, null, 2))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logEvent({ type: 'finish', published: false, runId, prevVisible, error: msg })
    if (prevVisible) {
      const fallbackHistory = dedupeRunIds([...(meta0?.historyRunIds || []), prevVisible]).slice(0, RUN_HISTORY_KEEP)
      await withRetry(
        () =>
          publishLowVolRun({
            nextRunId: prevVisible,
            previousRunId: fallbackHistory.length > 1 ? fallbackHistory[1] : null,
            keepRunIds: fallbackHistory,
            currentDataDate: meta0?.currentDataDate || null,
            publishStatus: 'failed',
            qualitySummary: {
              failedRunId: runId,
              error: msg,
              failedAt: new Date().toISOString(),
            },
          }),
        'mark lowvol publish failed',
        2,
      )
    }
    throw e
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack || e.message : String(e)}\n`)
  process.exit(1)
})
