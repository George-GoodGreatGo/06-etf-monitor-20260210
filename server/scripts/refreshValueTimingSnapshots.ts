import { getValueTimingIndexSeries, getValueTimingSupportedIndexCodes } from '../lib/valueTiming.js'
import { upsertValueTimingIndexSnapshot } from '../lib/supabaseRest.js'

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

function logEvent(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

async function main() {
  const startDate8 = ymd8YearsAgoJan1(6)
  const endDate8 = ymd8Of(new Date())
  const codes = getValueTimingSupportedIndexCodes()
  logEvent({ event: 'value_timing.refresh.start', startDate8, endDate8, count: codes.length })

  const failures: Array<{ code: string; error: string }> = []
  let ok = 0
  for (const code of codes) {
    const startedAt = Date.now()
    logEvent({ event: 'value_timing.refresh.index.start', code })
    try {
      const out = await getValueTimingIndexSeries({ code, startDate: startDate8, endDate: endDate8 })
      const payload = out.data && typeof out.data === 'object' ? out.data : { series: [] }
      const series = Array.isArray((payload as { series?: unknown }).series) ? ((payload as { series: unknown[] }).series ?? []) : []
      const last = series.length ? (series[series.length - 1] as any) : null
      const dataDate = last && typeof last === 'object' && typeof last.date === 'string' ? last.date : null
      if (!dataDate) throw new Error('computed series empty')
      const snapshotAt = new Date().toISOString()

      await upsertValueTimingIndexSnapshot({
        code,
        data_date: dataDate,
        snapshot_at: snapshotAt,
        source_type: 'computed',
        source: out.meta?.source ?? null,
        notes: Array.isArray(out.meta?.notes) ? out.meta.notes : [],
        payload,
      })

      logEvent({
        event: 'value_timing.refresh.index.done',
        code,
        dataDate,
        seriesLen: series.length,
        ms: Date.now() - startedAt,
      })
      ok += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logEvent({
        event: 'value_timing.refresh.index.fail',
        code,
        ms: Date.now() - startedAt,
        error: msg,
      })
      failures.push({ code, error: msg })
    }
  }

  const fail = failures.length
  if (fail > 0 && ok > 0) {
    logEvent({
      event: 'value_timing.refresh.partial_fail',
      ok,
      fail,
      failedCodes: failures.map((x) => x.code),
      failedReasons: failures.map((x) => `${x.code}:${String(x.error).slice(0, 160)}`),
    })
    logEvent({ event: 'value_timing.refresh.done', ok, fail })
    return
  }
  if (ok === 0) {
    logEvent({ event: 'value_timing.refresh.done', ok, fail })
    throw new Error(`value_timing refresh failed: all_failed fail=${fail}`)
  }
  logEvent({ event: 'value_timing.refresh.done', ok, fail })
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack || e.message : String(e)}\n`)
  process.exit(1)
})
