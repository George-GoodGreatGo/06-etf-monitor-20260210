import { getLowVolIndexSeries, getLowVolSupportedIndexCodes } from '../lib/lowVol.js'
import { readLatestLowVolIndexSnapshot, upsertLowVolIndexSnapshot } from '../lib/supabaseRest.js'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function ymd8Of(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

function ymd8YearsAgoJan1(years: number): string {
  const y = new Date().getUTCFullYear() - years
  return `${y}0101`
}

function nowBjtHour(): number {
  const ms = Date.now() + 8 * 60 * 60 * 1000
  return new Date(ms).getUTCHours()
}

function isWafError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('csindex blocked by WAF') || msg.includes('熔断中')
}

function logEvent(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

function dateFromYmd10(ymd10: string): Date | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

function ymd8MinusDays(ymd10: string, days: number): string | null {
  const d = dateFromYmd10(ymd10)
  if (!d) return null
  const ms = d.getTime() - Math.max(0, days) * 24 * 60 * 60 * 1000
  return ymd8Of(new Date(ms))
}

type SeriesPoint = { date: string } & Record<string, unknown>

function mergeSeries(history: SeriesPoint[], incoming: SeriesPoint[]): SeriesPoint[] {
  const m = new Map<string, SeriesPoint>()
  for (const p of history) {
    if (!p || typeof p !== 'object') continue
    const d = String((p as SeriesPoint).date || '')
    if (!d) continue
    m.set(d, p)
  }
  for (const p of incoming) {
    if (!p || typeof p !== 'object') continue
    const d = String((p as SeriesPoint).date || '')
    if (!d) continue
    m.set(d, p)
  }
  const out = Array.from(m.values())
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

async function refreshOneIncremental(args: {
  code: string
  coldStartStartDate8: string
  endDate8: string
  bufferDays: number
}): Promise<{ mode: 'cold_start' | 'incremental_merge'; dataDate: string; snapshotAt: string; seriesLen: number }> {
  const code = args.code
  const row = await readLatestLowVolIndexSnapshot(code)
  const payload = row?.payload && typeof row.payload === 'object' ? (row.payload as { series?: unknown }) : null
  const history = payload && Array.isArray(payload.series) ? (payload.series as SeriesPoint[]) : null

  const endDate = args.endDate8
  if (!row || !history) {
    const out = await getLowVolIndexSeries({ code, startDate: args.coldStartStartDate8, endDate })
    const snapshotAt = out.meta?.fetchedAt || new Date().toISOString()
    const series = (out.data?.series ?? []) as SeriesPoint[]
    const dd = out.meta?.dataDate || (series.length ? String(series[series.length - 1].date || '') : '')
    if (!dd) throw new Error(`missing dataDate for ${code}`)
    await upsertLowVolIndexSnapshot({
      code,
      data_date: dd,
      snapshot_at: snapshotAt,
      source_type: 'realtime',
      source: out.meta?.source ?? null,
      notes: [...(out.meta?.notes ?? []), 'refresh_mode=cold_start', `cold_years=10`],
      payload: { series },
    })
    return { mode: 'cold_start', dataDate: dd, snapshotAt, seriesLen: series.length }
  }

  const lastYmd10 = String(row.data_date || '').trim()
  const startFromLast = ymd8MinusDays(lastYmd10, args.bufferDays)
  const startDate = startFromLast && startFromLast >= args.coldStartStartDate8 ? startFromLast : args.coldStartStartDate8

  const inc = await getLowVolIndexSeries({ code, startDate, endDate })
  const snapshotAt = inc.meta?.fetchedAt || new Date().toISOString()
  const incSeries = (inc.data?.series ?? []) as SeriesPoint[]
  const merged = mergeSeries(history, incSeries)
  const dd = merged.length ? String(merged[merged.length - 1].date || '') : ''
  if (!dd) throw new Error(`missing merged dataDate for ${code}`)

  await upsertLowVolIndexSnapshot({
    code,
    data_date: dd,
    snapshot_at: snapshotAt,
    source_type: 'realtime',
    source: inc.meta?.source ?? null,
    notes: [...(inc.meta?.notes ?? []), 'refresh_mode=incremental_merge', `buffer_days=${args.bufferDays}`, `startDate=${startDate}`, `endDate=${endDate}`],
    payload: { series: merged },
  })

  return { mode: 'incremental_merge', dataDate: dd, snapshotAt, seriesLen: merged.length }
}

async function main() {
  const ignoreWindow = String(process.env.LOWVOL_REFRESH_IGNORE_WINDOW || '').trim() === '1'
  const hour = nowBjtHour()
  if (!ignoreWindow && !(hour >= 20 && hour < 22)) {
    process.stdout.write(JSON.stringify({ success: true, skipped: true, reason: 'outside_refresh_window', bjtHour: hour }, null, 2))
    return
  }

  const codes = getLowVolSupportedIndexCodes()
  const coldStartStartDate8 = ymd8YearsAgoJan1(10)
  const endDate8 = ymd8Of(new Date())
  const bufferDays = 5
  const startedAt = Date.now()

  logEvent({ type: 'start', codes: codes.length, coldStartStartDate8, endDate8, bufferDays, ignoreWindow })

  const results: Array<{ code: string; ok: boolean; error?: string }> = []
  for (let idx = 0; idx < codes.length; idx += 1) {
    const code = codes[idx]
    const t0 = Date.now()
    logEvent({ type: 'index_start', idx: idx + 1, total: codes.length, code })
    try {
      const r = await refreshOneIncremental({ code, coldStartStartDate8, endDate8, bufferDays })
      results.push({ code, ok: true })
      logEvent({
        type: 'index_done',
        idx: idx + 1,
        total: codes.length,
        code,
        ok: true,
        ms: Date.now() - t0,
        mode: r.mode,
        dataDate: r.dataDate,
        seriesLen: r.seriesLen,
      })
      await sleep(350 + Math.floor(Math.random() * 450))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isWafError(e)) {
        logEvent({ type: 'index_retry', idx: idx + 1, total: codes.length, code, ok: false, error: msg })
        await sleep(900 + Math.floor(Math.random() * 800))
        try {
          const r = await refreshOneIncremental({ code, coldStartStartDate8, endDate8, bufferDays })
          results.push({ code, ok: true })
          logEvent({
            type: 'index_done',
            idx: idx + 1,
            total: codes.length,
            code,
            ok: true,
            ms: Date.now() - t0,
            retried: true,
            mode: r.mode,
            dataDate: r.dataDate,
            seriesLen: r.seriesLen,
          })
          await sleep(350 + Math.floor(Math.random() * 450))
          continue
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2)
          results.push({ code, ok: false, error: msg2 })
          logEvent({ type: 'index_done', idx: idx + 1, total: codes.length, code, ok: false, error: msg2, ms: Date.now() - t0, retried: true })
          if (isWafError(e2)) break
          continue
        }
      }
      results.push({ code, ok: false, error: msg })
      logEvent({ type: 'index_done', idx: idx + 1, total: codes.length, code, ok: false, error: msg, ms: Date.now() - t0 })
      break
    }
  }

  const ok = results.filter((x) => x.ok).length
  const fail = results.length - ok
  logEvent({ type: 'finish', ok, fail, ms: Date.now() - startedAt })
  process.stdout.write(JSON.stringify({ success: fail === 0, ok, fail, coldStartStartDate8, endDate8, bufferDays, results }, null, 2))
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(msg)
  process.exit(1)
})
