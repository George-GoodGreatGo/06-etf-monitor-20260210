import { randomUUID } from 'node:crypto'
import { getValueTimingIndexSeries, getValueTimingSupportedIndexCodes, type ValueTimingDailyPoint } from '../lib/valueTiming.js'
import { publishValueTimingRun, readValueTimingMeta, type ValueTimingIndexPointRow, upsertValueTimingIndexPoints } from '../lib/supabaseRest.js'

const FULL_BACKFILL_START = '20160101'
const RUN_HISTORY_KEEP = 5
const COVERAGE_THRESHOLD = 0.95
const STALE_MAX_DAYS = 14

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd8Of(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

function nowBjtHour(): number {
  const ms = Date.now() + 8 * 60 * 60 * 1000
  return new Date(ms).getUTCHours()
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

function coverageRatio<T extends object>(rows: T[], key: keyof T): number {
  if (!rows.length) return 0
  let ok = 0
  for (const r of rows) {
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v)) ok += 1
  }
  return ok / rows.length
}

function summarizeCoverage(series: ValueTimingDailyPoint[]) {
  const tail = series.slice(-504)
  return {
    window: tail.length,
    closeCover: coverageRatio(tail, 'close'),
    peCover: coverageRatio(tail, 'pe'),
    spreadCover: coverageRatio(tail, 'spreadPct'),
    spreadRankCover: coverageRatio(tail, 'spreadPctRank5y'),
    biasCover: coverageRatio(tail, 'biasPct3y'),
  }
}

function parseNoteInt(notes: string[], key: string): number | null {
  const prefix = `${key}=`
  for (const n of notes) {
    if (!String(n).startsWith(prefix)) continue
    const v = Number(String(n).slice(prefix.length))
    if (Number.isFinite(v)) return v
  }
  return null
}

function mapSeriesToPointRows(args: {
  runId: string
  code: string
  fetchedAt: string
  source: string | null
  notes: string[]
  series: ValueTimingDailyPoint[]
}): Array<Omit<ValueTimingIndexPointRow, 'updated_at'>> {
  const { runId, code, fetchedAt, source, notes, series } = args
  return series.map((p) => ({
    run_id: runId,
    code,
    data_date: p.date,
    fetched_at: fetchedAt,
    source_type: 'computed',
    source,
    notes,
    close: p.close,
    ma60: p.ma60 ?? null,
    ma250: p.ma250 ?? null,
    bias60: p.bias60 ?? null,
    bias250: p.bias250 ?? null,
    bias_pct_3y_60: p.biasPct3y60 ?? null,
    bias_pct_3y: p.biasPct3y ?? null,
    pe: p.pe ?? null,
    earnings_yield_pct: p.earningsYieldPct ?? null,
    yield10y_pct: p.yield10yPct ?? null,
    spread_pct: p.spreadPct ?? null,
    spread_pct_rank_5y: p.spreadPctRank5y ?? null,
    pe_source: p.peSource ?? null,
    pe_source_notes: p.peSourceNotes ?? [],
  }))
}

function logEvent(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

async function main() {
  const ignoreWindow = String(process.env.VALUE_TIMING_REFRESH_IGNORE_WINDOW || '').trim() === '1'
  const hour = nowBjtHour()
  if (!ignoreWindow && !(hour >= 20 && hour < 22)) {
    process.stdout.write(JSON.stringify({ success: true, skipped: true, reason: 'outside_refresh_window', bjtHour: hour }, null, 2))
    return
  }

  const startDate8 = FULL_BACKFILL_START
  const endDate8 = ymd8Of(new Date())
  const endDate10 = ymd8ToYmd10(endDate8)
  if (!endDate10) throw new Error('bad endDate')
  const codes = getValueTimingSupportedIndexCodes()
  const meta0 = await readValueTimingMeta()
  const prevVisible = meta0?.currentRunId || null
  const runId = randomUUID()
  const startedAt = Date.now()
  const perCode: Record<string, unknown> = {}
  logEvent({ event: 'value_timing.refresh.start', mode: 'full_backfill_publish', runId, prevVisible, startDate8, endDate8, count: codes.length, ignoreWindow })

  try {
    let maxDataDate: string | null = null
    let totalRows = 0
    for (let idx = 0; idx < codes.length; idx += 1) {
      const code = codes[idx]
      const t0 = Date.now()
      logEvent({ event: 'value_timing.refresh.index.start', idx: idx + 1, total: codes.length, code, runId })
      const out = await getValueTimingIndexSeries({ code, startDate: startDate8, endDate: endDate8 })
      const series = out.data?.series ?? []
      if (!series.length) throw new Error(`empty series: ${code}`)
      const last = series[series.length - 1]
      const lag = diffDaysUtc(endDate10, last.date)
      if (lag != null && lag > STALE_MAX_DAYS) {
        throw new Error(`series stale: code=${code} last=${last.date} lag=${lag}d`)
      }
      const cov = summarizeCoverage(series)
      const strict = code !== '980081'
      const peThreshold = strict ? COVERAGE_THRESHOLD : 0.05
      const spreadThreshold = strict ? COVERAGE_THRESHOLD : 0.05
      const spreadRankThreshold = strict ? COVERAGE_THRESHOLD : 0.0
      const biasThreshold = strict ? COVERAGE_THRESHOLD : 0.0
      if (
        cov.window >= 200 &&
        (cov.closeCover < COVERAGE_THRESHOLD ||
          cov.peCover < peThreshold ||
          cov.spreadCover < spreadThreshold ||
          cov.spreadRankCover < spreadRankThreshold ||
          cov.biasCover < biasThreshold)
      ) {
        throw new Error(
          `coverage failed: code=${code} close=${cov.closeCover.toFixed(3)} pe=${cov.peCover.toFixed(3)} spread=${cov.spreadCover.toFixed(3)} spreadRank=${cov.spreadRankCover.toFixed(3)} bias=${cov.biasCover.toFixed(3)}`,
        )
      }

      const rows = mapSeriesToPointRows({
        runId,
        code,
        fetchedAt: out.meta.fetchedAt || new Date().toISOString(),
        source: out.meta.source || null,
        notes: Array.isArray(out.meta.notes) ? out.meta.notes : [],
        series,
      })
      for (const part of chunk(rows, 200)) await upsertValueTimingIndexPoints(part)
      totalRows += rows.length
      if (!maxDataDate || last.date > maxDataDate) maxDataDate = last.date
      perCode[code] = { rows: rows.length, dataDate: last.date, lagDays: lag, coverage: cov }
      if (code === '980081') {
        const sourceStats = {
          baselinePoints: parseNoteInt(Array.isArray(out.meta?.notes) ? out.meta.notes : [], 'pe_baseline_points'),
          newDailyPoints: parseNoteInt(Array.isArray(out.meta?.notes) ? out.meta.notes : [], 'pe_new_daily_points'),
          overwriteDays: parseNoteInt(Array.isArray(out.meta?.notes) ? out.meta.notes : [], 'pe_overwrite_days'),
        }
        perCode[code] = { ...(perCode[code] as object), sourceStats }
      }
      logEvent({ event: 'value_timing.refresh.index.done', idx: idx + 1, total: codes.length, code, runId, rows: rows.length, dataDate: last.date, lagDays: lag, ms: Date.now() - t0 })
    }

    if (!maxDataDate) throw new Error('missing maxDataDate')
    const historyRunIds = dedupeRunIds([runId, ...(meta0?.historyRunIds || []), prevVisible, meta0?.previousRunId]).slice(0, RUN_HISTORY_KEEP)
    const previousRunId = historyRunIds.length > 1 ? historyRunIds[1] : null
    await publishValueTimingRun({
      nextRunId: runId,
      previousRunId,
      keepRunIds: historyRunIds,
      currentDataDate: maxDataDate,
      publishStatus: 'ready',
      qualitySummary: {
        mode: 'full_backfill_publish',
        startDate8,
        endDate8,
        totalRows,
        maxDataDate,
        maxStaleDays: STALE_MAX_DAYS,
        coverageThreshold: COVERAGE_THRESHOLD,
        perCode,
      },
    })

    const ms = Date.now() - startedAt
    logEvent({ event: 'value_timing.refresh.done', published: true, runId, prevVisible, keepRuns: historyRunIds, maxDataDate, totalRows, ms })
    process.stdout.write(JSON.stringify({ success: true, runId, prevVisible, published: true, keepRuns: historyRunIds, maxDataDate, totalRows, ms }, null, 2))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logEvent({ event: 'value_timing.refresh.done', published: false, runId, prevVisible, error: msg })
    if (prevVisible) {
      const fallbackHistory = dedupeRunIds([...(meta0?.historyRunIds || []), prevVisible]).slice(0, RUN_HISTORY_KEEP)
      await publishValueTimingRun({
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
      })
    }
    throw e
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack || e.message : String(e)}\n`)
  process.exit(1)
})
