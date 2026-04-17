import { getMarketLiquidityV5 } from '../lib/marketLiquidityV5Service.js'
import { randomUUID } from 'node:crypto'
import {
  publishMarketBoardRun,
  readMarketBoardMeta,
  upsertMarketBoardMeta,
  upsertMarketBoardPoints,
  type MarketBoardPointRow,
} from '../lib/supabaseRest.js'
import { fetchCsindexHs300PeSeries } from '../lib/csindex.js'
import { fetchNorthboundTotalTurnoverSeries } from '../lib/hkex.js'
import { fetchGovBond10yYieldPctByDateWithFallbackSafe } from '../lib/chinamoneyGovBond.js'

const FULL_BACKFILL_START = '20160101'
const RUN_HISTORY_KEEP = 5
const COVERAGE_THRESHOLD = 0.95

function argValue(name: string): string | null {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return null
  const v = process.argv[idx + 1]
  return typeof v === 'string' && v.trim() ? v.trim() : null
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

function ymd8BeijingToday(): string {
  const d = new Date(Date.now() + 8 * 3600_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function ymd8BeijingYearsAgo(years: number): string {
  const d = new Date(Date.now() + 8 * 3600_000)
  d.setUTCFullYear(d.getUTCFullYear() - years)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function ymd8ToYmd10(ymd8: string): string {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function finiteOrNull(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : raw == null ? NaN : Number(String(raw).trim())
  return Number.isFinite(n) ? n : null
}

function amountKyuanToYiyuan(raw: unknown): number | null {
  const n = finiteOrNull(raw)
  if (n == null) return null
  return n / 100000
}

function normalizeAmountUnitNotes(rawNotes: unknown): unknown[] | null {
  if (!Array.isArray(rawNotes)) return null
  const out: unknown[] = []
  for (const it of rawNotes) {
    if (typeof it !== 'string') {
      out.push(it)
      continue
    }
    let s = it.replace(/“千元”/g, '“亿元”')
    s = s.replace(/千元/g, '亿元')
    out.push(s)
  }
  return out
}

function ymd8ToYear(ymd8: string): number | null {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  return Number.isFinite(y) ? y : null
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

function maxYmd8(a: string, b: string): string {
  return a >= b ? a : b
}

function minYmd8(a: string, b: string): string {
  return a <= b ? a : b
}

function shiftYmd8Years(ymd8: string, yearsDelta: number): string {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return ''
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(4, 6))
  const d = Number(s.slice(6, 8))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCFullYear(dt.getUTCFullYear() + yearsDelta)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitterMs(baseMs: number, jitterPct: number): number {
  const base = Math.max(0, Math.floor(baseMs))
  const pct = Math.max(0, Math.min(1, jitterPct))
  const span = Math.floor(base * pct)
  if (span <= 0) return base
  const delta = Math.floor(Math.random() * (span + 1))
  return base + delta
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries: number): Promise<T> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (attempt > 0) {
        const backoff = Math.min(60_000, 1000 * 2 ** (attempt - 1))
        const wait = jitterMs(backoff, 0.4)
        process.stdout.write(`[retry] ${label} attempt=${attempt}/${maxRetries} sleep=${wait}ms\n`)
        await sleep(wait)
      }
      return await fn()
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      process.stderr.write(`[retry] ${label} failed attempt=${attempt}/${maxRetries}: ${msg}\n`)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function summarizeCoverage(rows: Array<Record<string, unknown>>) {
  const tail = rows.slice(-504)
  const amountCover = nonNullRatio(tail, 'amount')
  const trCover = nonNullRatio(tail, 'tr')
  const northCover = nonNullRatio(tail, 'north_money')
  const peCover = nonNullRatio(tail, 'pe')
  const y10Cover = nonNullRatio(tail, 'yield10y_pct')
  return {
    window: tail.length,
    amountCover,
    trCover,
    northCover,
    peCover,
    y10Cover,
  }
}

type ProbeDetail = {
  source: 'northbound' | 'hs300_pe' | 'yield10y'
  ok: boolean
  count: number
  note?: string
  error?: string
}

type ProbeSummary = {
  ok: boolean
  hardFailed: boolean
  details: ProbeDetail[]
}

async function probeNorthboundWithFallback(args: { startDate1y: string; endDate: string }): Promise<ProbeDetail> {
  const endDate = String(args.endDate || '').trim()
  const candidates = [
    String(args.startDate1y || '').trim(),
    maxYmd8(FULL_BACKFILL_START, shiftYmd8Years(endDate, -3) || FULL_BACKFILL_START),
    maxYmd8(FULL_BACKFILL_START, shiftYmd8Years(endDate, -5) || FULL_BACKFILL_START),
  ]
  const uniqueStarts = dedupeRunIds(candidates)
  for (let i = 0; i < uniqueStarts.length; i += 1) {
    const start = uniqueStarts[i] || ''
    if (!start) continue
    const rows = await fetchNorthboundTotalTurnoverSeries({ startDate: start, endDate })
    if (Array.isArray(rows) && rows.length > 0) {
      const label = i === 0 ? '1y' : i === 1 ? '3y-fallback' : '5y-fallback'
      return { source: 'northbound', ok: true, count: rows.length, note: label }
    }
  }
  return { source: 'northbound', ok: false, count: 0, error: 'northbound empty after 1y/3y/5y fallback' }
}

async function runSourceConnectivityProbe(args: { endDate: string }): Promise<ProbeSummary> {
  const endDate = String(args.endDate || '').trim()
  const oneYearAgo = shiftYmd8Years(endDate, -1) || FULL_BACKFILL_START
  const probeStart = maxYmd8(FULL_BACKFILL_START, oneYearAgo)
  const endYear = ymd8ToYear(endDate) || new Date().getUTCFullYear()

  process.stdout.write(`[probe] start=${probeStart} end=${endDate} year=${endYear}\n`)

  const details: ProbeDetail[] = []

  const hs300Check: ProbeDetail = await Promise.resolve(
    withRetry(async () => {
      const rows = await fetchCsindexHs300PeSeries({ startDate: probeStart, endDate })
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('hs300 pe empty')
      return rows.length
    }, 'probe:hs300_pe', 2),
  )
    .then((count) => ({ source: 'hs300_pe' as const, ok: true, count }))
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      return { source: 'hs300_pe' as const, ok: false, count: 0, error: msg }
    })
  details.push(hs300Check)
  if (hs300Check.ok) process.stdout.write(`[probe] ok hs300_pe count=${hs300Check.count}\n`)
  else process.stderr.write(`[probe] failed hs300_pe err=${hs300Check.error}\n`)

  const northCheck: ProbeDetail = await Promise.resolve(
    withRetry(() => probeNorthboundWithFallback({ startDate1y: probeStart, endDate }), 'probe:northbound', 2),
  )
    .then((d) => d)
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      return { source: 'northbound' as const, ok: false, count: 0, error: msg }
    })
  details.push(northCheck)
  if (northCheck.ok) {
    process.stdout.write(`[probe] ok northbound count=${northCheck.count}${northCheck.note ? ` note=${northCheck.note}` : ''}\n`)
  } else {
    process.stderr.write(`[probe] warn northbound err=${northCheck.error}\n`)
  }

  const y10Check: ProbeDetail = await Promise.resolve(
    withRetry(async () => {
      const out = await fetchGovBond10yYieldPctByDateWithFallbackSafe({ year: endYear })
      if (out.error) throw new Error(out.error)
      if (!(out.map instanceof Map) || out.map.size === 0) throw new Error('yield10y empty')
      return { count: out.map.size, source: out.source || 'unknown', fallbackUsed: out.fallbackUsed }
    }, 'probe:yield10y', 2),
  )
    .then((r) => ({
      source: 'yield10y' as const,
      ok: true,
      count: r.count,
      note: `source=${r.source};fallback=${r.fallbackUsed ? '1' : '0'}`,
    }))
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      return { source: 'yield10y' as const, ok: false, count: 0, error: msg }
    })
  details.push(y10Check)
  if (y10Check.ok) {
    process.stdout.write(`[probe] ok yield10y count=${y10Check.count}${y10Check.note ? ` note=${y10Check.note}` : ''}\n`)
  }
  else process.stderr.write(`[probe] warn yield10y err=${y10Check.error}\n`)

  const hardFailed = !hs300Check.ok
  return {
    ok: !hardFailed,
    hardFailed,
    details,
  }
}

type Out = {
  success?: unknown
  meta?: Record<string, unknown>
  data?: Record<string, unknown>
}

function mustArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []
}

function nonNullRatio(rows: Array<Record<string, unknown>>, key: string): number {
  if (!rows.length) return 0
  let ok = 0
  for (const r of rows) {
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v)) ok += 1
  }
  return ok / rows.length
}

async function main() {
  const mode = (argValue('--mode') || 'backfill').toLowerCase()
  const defaultStartDate = mode === 'backfill' ? FULL_BACKFILL_START : ymd8BeijingYearsAgo(10)
  const startDate = argValue('--startDate') || defaultStartDate
  const endDate = argValue('--endDate') || ymd8BeijingToday()
  const start10 = ymd8ToYmd10(startDate)
  const end10 = ymd8ToYmd10(endDate)
  if (!start10 || !end10) throw new Error('bad startDate/endDate (expect YYYYMMDD)')

  process.env.MARKET_DATA_SOURCE = String(process.env.MARKET_DATA_SOURCE || '').trim() || 'financedata'

  process.stdout.write(`mode=${mode} range=${startDate}..${endDate}\n`)
  if (mode === 'backfill') {
    const meta0 = await readMarketBoardMeta()
    const prevVisible = meta0?.currentRunId || null
    const runId = randomUUID()
    process.stdout.write(`[run] new_run_id=${runId} prev_visible=${prevVisible || 'null'}\n`)

    try {
      const probeSummary = await runSourceConnectivityProbe({ endDate })
      if (probeSummary.hardFailed) {
        const failed = probeSummary.details
          .filter((d) => !d.ok)
          .map((d) => `${d.source}=${d.error || 'failed'}`)
          .join('; ')
        throw new Error(`source connectivity probe hard-failed: ${failed || 'unknown'}`)
      }
      const probeWarn = probeSummary.details.filter((d) => !d.ok)
      if (probeWarn.length > 0) {
        process.stderr.write(
          `[probe] soft-fail continue: ${probeWarn.map((d) => `${d.source}=${d.error || 'failed'}`).join('; ')}\n`,
        )
      }

      const y0 = ymd8ToYear(startDate)
      const y1 = ymd8ToYear(endDate)
      if (y0 == null || y1 == null) throw new Error('bad startDate/endDate year')
      let totalWrite = 0
      let maxDate: string | null = null
      const recentRows: Array<Omit<MarketBoardPointRow, 'updated_at'>> = []
      for (let y = y0; y <= y1; y += 2) {
        const segStart = maxYmd8(startDate, `${y}0101`)
        const segEnd = minYmd8(endDate, `${Math.min(y + 1, y1)}1231`)
        if (segStart > segEnd) continue

        const computeStartRaw = shiftYmd8Years(segStart, -6)
        const computeStart = computeStartRaw ? maxYmd8(startDate, computeStartRaw) : startDate
        const computeEnd = segEnd
        const segStart10 = ymd8ToYmd10(segStart)
        const segEnd10 = ymd8ToYmd10(segEnd)
        process.stdout.write(`[segment] out=${segStart}..${segEnd} compute=${computeStart}..${computeEnd}\n`)

        const out = (await withRetry(
          () => getMarketLiquidityV5({ startDate: computeStart, endDate: computeEnd, forceRefresh: true }),
          `compute segment ${segStart}..${segEnd}`,
          5,
        )) as Out
        if (out.success !== true) throw new Error(`market board compute failed(seg ${segStart}..${segEnd})`)

        const meta = out.meta && typeof out.meta === 'object' ? out.meta : {}
        const fetchedAt = typeof meta.fetchedAt === 'string' ? meta.fetchedAt : new Date().toISOString()
        const sourceType = typeof meta.sourceType === 'string' ? meta.sourceType : null
        const source = typeof meta.source === 'string' ? meta.source : null
        const notes = normalizeAmountUnitNotes(meta.notes)

        const data = out.data && typeof out.data === 'object' ? out.data : {}
        const seriesAll = mustArray((data as Record<string, unknown>).series)
        const allLast = seriesAll.length ? seriesAll[seriesAll.length - 1] : null
        const allLastDate = allLast && typeof allLast.date === 'string' ? String(allLast.date) : ''
        if (allLastDate) {
          const lag = diffDaysUtc(segEnd10, allLastDate)
          if (lag != null && lag > 7) {
            throw new Error(`segment source stale: out_last_date=${allLastDate} seg_end=${segEnd10} lag=${lag}d`)
          }
        }
        const series = seriesAll.filter((p) => {
          const d = typeof p.date === 'string' ? p.date : ''
          return d && d >= segStart10 && d <= segEnd10
        })

        const equityBond = (data as Record<string, unknown>).equityBond
        const equityBondSeriesAll = mustArray((equityBond as Record<string, unknown> | null)?.series)
        const equityBondSeries = equityBondSeriesAll.filter((p) => {
          const d = typeof p.date === 'string' ? p.date : ''
          return d && d >= segStart10 && d <= segEnd10
        })

        const ebByDate = new Map<string, Record<string, unknown>>()
        for (const p of equityBondSeries) {
          const d = typeof p.date === 'string' ? p.date : ''
          if (!d) continue
          ebByDate.set(d, p)
        }

        const rows = series
          .map((p) => {
            const date = typeof p.date === 'string' ? p.date : ''
            const close = typeof p.close === 'number' ? p.close : NaN
            if (!date || !Number.isFinite(close)) return null
            const eb = ebByDate.get(date) || null
            return {
              run_id: runId,
              data_date: date,
              fetched_at: fetchedAt,
              source_type: sourceType,
              source,
              notes,
              close,
              amount: amountKyuanToYiyuan(p.amount),
              tr: finiteOrNull(p.tr),
              north_money: finiteOrNull(p.northMoney),
              amount_pct: finiteOrNull(p.amountPct),
              tr_pct: finiteOrNull(p.trPct),
              north_pct: finiteOrNull(p.northPct),
              v5: finiteOrNull(p.v5),
              v5_pct: finiteOrNull(p.v5Pct),
              pe: finiteOrNull(eb?.pe),
              earnings_yield: finiteOrNull(eb?.earningsYield),
              yield10y_pct: finiteOrNull(eb?.yield10yPct),
              equity_bond_value: finiteOrNull(eb?.value),
              equity_bond_pct: finiteOrNull(eb?.pct),
            }
          })
          .filter((x): x is NonNullable<typeof x> => x != null)

        if (rows.length === 0) {
          throw new Error(`segment produced no rows: out=${segStart}..${segEnd}`)
        }

        for (const part of chunk(rows, 200)) {
          await withRetry(() => upsertMarketBoardPoints(part as Array<Omit<MarketBoardPointRow, 'updated_at'>>), `upsert batch size=${part.length}`, 4)
          await sleep(jitterMs(350, 0.6))
        }
        totalWrite += rows.length
        const segMax = rows[rows.length - 1]?.data_date
        if (typeof segMax === 'string') maxDate = maxDate ? (segMax > maxDate ? segMax : maxDate) : segMax
        for (const r of rows) recentRows.push(r)
        while (recentRows.length > 700) recentRows.shift()

        if (recentRows.length) {
          const cov = summarizeCoverage(recentRows)
          process.stdout.write(
            `[segment] cover(last${cov.window}) amount=${(cov.amountCover * 100).toFixed(1)}% tr=${(cov.trCover * 100).toFixed(1)}% north=${(cov.northCover * 100).toFixed(1)}% pe=${(cov.peCover * 100).toFixed(1)}% y10=${(cov.y10Cover * 100).toFixed(1)}%\n`,
          )
        }
        process.stdout.write(`[segment] wrote=${rows.length} total=${totalWrite}\n`)
        await sleep(jitterMs(5_000, 0.8))
      }

      if (!maxDate) throw new Error('backfill produced no data')
      const lagAll = diffDaysUtc(end10, maxDate)
      if (lagAll != null && lagAll > 7) {
        throw new Error(`backfill max_date too old: max_date=${maxDate} end=${end10} lag=${lagAll}d`)
      }

      const cov = summarizeCoverage(recentRows)
      process.stdout.write(
        `[run] max_date=${maxDate} cover(last${cov.window}) amount=${(cov.amountCover * 100).toFixed(1)}% tr=${(cov.trCover * 100).toFixed(1)}% north=${(cov.northCover * 100).toFixed(1)}% pe=${(cov.peCover * 100).toFixed(1)}% y10=${(cov.y10Cover * 100).toFixed(1)}%\n`,
      )
      if (
        cov.window >= 200 &&
        (cov.amountCover < COVERAGE_THRESHOLD ||
          cov.trCover < COVERAGE_THRESHOLD ||
          cov.northCover < COVERAGE_THRESHOLD ||
          cov.peCover < COVERAGE_THRESHOLD ||
          cov.y10Cover < COVERAGE_THRESHOLD)
      ) {
        throw new Error(`backfill coverage check failed (threshold=${(COVERAGE_THRESHOLD * 100).toFixed(0)}%)`)
      }

      const historyRunIds = dedupeRunIds([runId, ...(meta0?.historyRunIds || []), prevVisible, meta0?.previousRunId]).slice(
        0,
        RUN_HISTORY_KEEP,
      )
      const previousRunId = historyRunIds.length > 1 ? historyRunIds[1] : null
      const qualitySummary = {
        write: totalWrite,
        maxDate,
        coverageWindow: cov.window,
        amountCover: cov.amountCover,
        trCover: cov.trCover,
        northCover: cov.northCover,
        peCover: cov.peCover,
        y10Cover: cov.y10Cover,
        probeSummary: probeSummary.details.map((d) => ({
          source: d.source,
          ok: d.ok,
          count: d.count,
          note: d.note || null,
          error: d.error || null,
        })),
      }

      await withRetry(
        () =>
          publishMarketBoardRun({
            nextRunId: runId,
            previousRunId,
            keepRunIds: historyRunIds,
            currentDataDate: maxDate,
            publishStatus: 'ready',
            qualitySummary,
          }),
        'publish run atomically',
        3,
      )
      process.stdout.write(`mode=${mode} write=${totalWrite} visible_run=${runId} keep_runs=${historyRunIds.join(',')}\n`)
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      process.stderr.write(`[run] backfill failed run_id=${runId} err=${msg}\n`)
      if (prevVisible) {
        const fallbackHistory = dedupeRunIds([...(meta0?.historyRunIds || []), prevVisible]).slice(0, RUN_HISTORY_KEEP)
        await withRetry(
          () =>
            upsertMarketBoardMeta({
              currentRunId: prevVisible,
              previousRunId: fallbackHistory.length > 1 ? fallbackHistory[1] : null,
              historyRunIds: fallbackHistory,
              currentDataDate: meta0?.currentDataDate || null,
              publishStatus: 'failed',
              qualitySummary: {
                failedRunId: runId,
                error: msg,
                failedAt: new Date().toISOString(),
              },
            }),
          'mark publish failed',
          2,
        )
      }
      throw e
    }
  }

  if (mode === 'incremental') {
    const meta0 = await readMarketBoardMeta()
    const runId = meta0?.currentRunId || ''
    if (!runId) throw new Error('missing current run id')
    process.stdout.write(`[run] incremental current_run_id=${runId}\n`)

    const out = (await withRetry(() => getMarketLiquidityV5({ startDate, endDate, forceRefresh: true }), 'compute market board', 5)) as Out
    if (out.success !== true) throw new Error(`market board compute failed: ${JSON.stringify(out)}`)

    const meta = out.meta && typeof out.meta === 'object' ? out.meta : {}
    const fetchedAt = typeof meta.fetchedAt === 'string' ? meta.fetchedAt : new Date().toISOString()
    const sourceType = typeof meta.sourceType === 'string' ? meta.sourceType : null
    const source = typeof meta.source === 'string' ? meta.source : null
    const notes = normalizeAmountUnitNotes(meta.notes)

    const data = out.data && typeof out.data === 'object' ? out.data : {}
    const series = mustArray((data as Record<string, unknown>).series)
    const equityBond = (data as Record<string, unknown>).equityBond
    const equityBondSeries = mustArray((equityBond as Record<string, unknown> | null)?.series)

    const ebByDate = new Map<string, Record<string, unknown>>()
    for (const p of equityBondSeries) {
      const d = typeof p.date === 'string' ? p.date : ''
      if (!d) continue
      ebByDate.set(d, p)
    }

    const rows = series
      .map((p) => {
        const date = typeof p.date === 'string' ? p.date : ''
        const close = typeof p.close === 'number' ? p.close : NaN
        if (!date || !Number.isFinite(close)) return null
        const eb = ebByDate.get(date) || null
        return {
          run_id: runId,
          data_date: date,
          fetched_at: fetchedAt,
          source_type: sourceType,
          source,
          notes,
          close,
          amount: amountKyuanToYiyuan(p.amount),
          tr: finiteOrNull(p.tr),
          north_money: finiteOrNull(p.northMoney),
          amount_pct: finiteOrNull(p.amountPct),
          tr_pct: finiteOrNull(p.trPct),
          north_pct: finiteOrNull(p.northPct),
          v5: finiteOrNull(p.v5),
          v5_pct: finiteOrNull(p.v5Pct),
          pe: finiteOrNull(eb?.pe),
          earnings_yield: finiteOrNull(eb?.earningsYield),
          yield10y_pct: finiteOrNull(eb?.yield10yPct),
          equity_bond_value: finiteOrNull(eb?.value),
          equity_bond_pct: finiteOrNull(eb?.pct),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)

    const finalRows = rows.slice(-5)
    const dates = finalRows.map((r) => r.data_date)
    for (const part of chunk(finalRows, 200)) {
      await withRetry(() => upsertMarketBoardPoints(part as Array<Omit<MarketBoardPointRow, 'updated_at'>>), `upsert batch size=${part.length}`, 4)
      await sleep(jitterMs(350, 0.6))
    }
    process.stdout.write(`mode=${mode} write=${finalRows.length} dates=${dates.join(',')}\n`)
    return
  }
  throw new Error(`unknown mode: ${mode}`)
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack || e.message : String(e)}\n`)
  process.exit(1)
})
