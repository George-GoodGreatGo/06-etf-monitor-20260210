import { getMarketLiquidityV5 } from '../lib/marketLiquidityV5Service.js'
import { randomUUID } from 'node:crypto'
import { deleteMarketBoardPointsNotInRuns, readMarketBoardMeta, upsertMarketBoardMeta, upsertMarketBoardPoints } from '../lib/supabaseRest.js'

function argValue(name: string): string | null {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return null
  const v = process.argv[idx + 1]
  return typeof v === 'string' && v.trim() ? v.trim() : null
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

function ymd8ToYear(ymd8: string): number | null {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  return Number.isFinite(y) ? y : null
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

type Out = {
  success?: unknown
  meta?: Record<string, unknown>
  data?: Record<string, unknown>
}

function mustArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []
}

async function main() {
  const mode = (argValue('--mode') || 'backfill').toLowerCase()
  const startDate = argValue('--startDate') || ymd8BeijingYearsAgo(10)
  const endDate = argValue('--endDate') || ymd8BeijingToday()
  const start10 = ymd8ToYmd10(startDate)
  const end10 = ymd8ToYmd10(endDate)
  if (!start10 || !end10) throw new Error('bad startDate/endDate (expect YYYYMMDD)')

  process.env.MARKET_DATA_SOURCE = String(process.env.MARKET_DATA_SOURCE || '').trim() || 'akshare-first'

  process.stdout.write(`mode=${mode} range=${startDate}..${endDate}\n`)
  if (mode === 'backfill') {
    const meta0 = await readMarketBoardMeta()
    const prevVisible = meta0?.currentRunId || null
    const runId = randomUUID()
    process.stdout.write(`[run] new_run_id=${runId} prev_visible=${prevVisible || 'null'}\n`)

    const y0 = ymd8ToYear(startDate)
    const y1 = ymd8ToYear(endDate)
    if (y0 == null || y1 == null) throw new Error('bad startDate/endDate year')
    let totalWrite = 0
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
      const notes = Array.isArray(meta.notes) ? meta.notes : null

      const data = out.data && typeof out.data === 'object' ? out.data : {}
      const seriesAll = mustArray((data as Record<string, unknown>).series)
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
            amount: typeof p.amount === 'number' ? (p.amount as number) : p.amount == null ? null : Number(p.amount),
            tr: typeof p.tr === 'number' ? (p.tr as number) : p.tr == null ? null : Number(p.tr),
            north_money:
              typeof p.northMoney === 'number' ? (p.northMoney as number) : p.northMoney == null ? null : Number(p.northMoney),
            amount_pct:
              typeof p.amountPct === 'number' ? (p.amountPct as number) : p.amountPct == null ? null : Number(p.amountPct),
            tr_pct: typeof p.trPct === 'number' ? (p.trPct as number) : p.trPct == null ? null : Number(p.trPct),
            north_pct:
              typeof p.northPct === 'number' ? (p.northPct as number) : p.northPct == null ? null : Number(p.northPct),
            v5: typeof p.v5 === 'number' ? (p.v5 as number) : p.v5 == null ? null : Number(p.v5),
            v5_pct: typeof p.v5Pct === 'number' ? (p.v5Pct as number) : p.v5Pct == null ? null : Number(p.v5Pct),
            pe: eb && typeof eb.pe === 'number' ? (eb.pe as number) : eb && eb.pe != null ? Number(eb.pe) : null,
            earnings_yield:
              eb && typeof eb.earningsYield === 'number'
                ? (eb.earningsYield as number)
                : eb && eb.earningsYield != null
                  ? Number(eb.earningsYield)
                  : null,
            yield10y_pct:
              eb && typeof eb.yield10yPct === 'number'
                ? (eb.yield10yPct as number)
                : eb && eb.yield10yPct != null
                  ? Number(eb.yield10yPct)
                  : null,
            equity_bond_value: eb && typeof eb.value === 'number' ? (eb.value as number) : eb && eb.value != null ? Number(eb.value) : null,
            equity_bond_pct: eb && typeof eb.pct === 'number' ? (eb.pct as number) : eb && eb.pct != null ? Number(eb.pct) : null,
          }
        })
        .filter((x) => x != null)

      for (const part of chunk(rows, 200)) {
        await withRetry(() => upsertMarketBoardPoints(part as any), `upsert batch size=${part.length}`, 4)
        await sleep(jitterMs(350, 0.6))
      }
      totalWrite += rows.length
      process.stdout.write(`[segment] wrote=${rows.length} total=${totalWrite}\n`)
      await sleep(jitterMs(5_000, 0.8))
    }
    await withRetry(() => upsertMarketBoardMeta({ currentRunId: runId, previousRunId: prevVisible }), 'switch visible run', 3)
    if (prevVisible) {
      await withRetry(() => deleteMarketBoardPointsNotInRuns({ keepRunIds: [runId, prevVisible] }), 'cleanup old runs', 3)
    } else {
      await withRetry(() => deleteMarketBoardPointsNotInRuns({ keepRunIds: [runId] }), 'cleanup old runs', 3)
    }
    process.stdout.write(`mode=${mode} write=${totalWrite} visible_run=${runId}\n`)
    return
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
    const notes = Array.isArray(meta.notes) ? meta.notes : null

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
          amount: typeof p.amount === 'number' ? (p.amount as number) : p.amount == null ? null : Number(p.amount),
          tr: typeof p.tr === 'number' ? (p.tr as number) : p.tr == null ? null : Number(p.tr),
          north_money:
            typeof p.northMoney === 'number' ? (p.northMoney as number) : p.northMoney == null ? null : Number(p.northMoney),
          amount_pct:
            typeof p.amountPct === 'number' ? (p.amountPct as number) : p.amountPct == null ? null : Number(p.amountPct),
          tr_pct: typeof p.trPct === 'number' ? (p.trPct as number) : p.trPct == null ? null : Number(p.trPct),
          north_pct:
            typeof p.northPct === 'number' ? (p.northPct as number) : p.northPct == null ? null : Number(p.northPct),
          v5: typeof p.v5 === 'number' ? (p.v5 as number) : p.v5 == null ? null : Number(p.v5),
          v5_pct: typeof p.v5Pct === 'number' ? (p.v5Pct as number) : p.v5Pct == null ? null : Number(p.v5Pct),
          pe: eb && typeof eb.pe === 'number' ? (eb.pe as number) : eb && eb.pe != null ? Number(eb.pe) : null,
          earnings_yield:
            eb && typeof eb.earningsYield === 'number'
              ? (eb.earningsYield as number)
              : eb && eb.earningsYield != null
                ? Number(eb.earningsYield)
                : null,
          yield10y_pct:
            eb && typeof eb.yield10yPct === 'number'
              ? (eb.yield10yPct as number)
              : eb && eb.yield10yPct != null
                ? Number(eb.yield10yPct)
                : null,
          equity_bond_value: eb && typeof eb.value === 'number' ? (eb.value as number) : eb && eb.value != null ? Number(eb.value) : null,
          equity_bond_pct: eb && typeof eb.pct === 'number' ? (eb.pct as number) : eb && eb.pct != null ? Number(eb.pct) : null,
        }
      })
      .filter((x) => x != null)

    const finalRows = rows.slice(-5)
    const dates = finalRows.map((r) => r.data_date)
    for (const part of chunk(finalRows, 200)) {
      await withRetry(() => upsertMarketBoardPoints(part as any), `upsert batch size=${part.length}`, 4)
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
