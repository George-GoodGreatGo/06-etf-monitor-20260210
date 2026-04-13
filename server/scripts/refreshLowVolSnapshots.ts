import { getLowVolIndexSeries, getLowVolSupportedIndexCodes } from '../lib/lowVol.js'
import { upsertLowVolIndexSnapshot } from '../lib/supabaseRest.js'

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

async function refreshOne(code: string, startDate: string, endDate: string): Promise<void> {
  const out = await getLowVolIndexSeries({ code, startDate, endDate })
  const dataDate = out.meta?.dataDate || null
  const snapshotAt = out.meta?.fetchedAt || new Date().toISOString()
  const dd = dataDate || (out.data?.series?.length ? out.data.series[out.data.series.length - 1].date : '')
  if (!dd) throw new Error(`missing dataDate for ${code}`)

  await upsertLowVolIndexSnapshot({
    code,
    data_date: dd,
    snapshot_at: snapshotAt,
    source_type: 'realtime',
    source: out.meta?.source ?? null,
    notes: out.meta?.notes ?? [],
    payload: out.data,
  })
}

async function main() {
  const ignoreWindow = String(process.env.LOWVOL_REFRESH_IGNORE_WINDOW || '').trim() === '1'
  const hour = nowBjtHour()
  if (!ignoreWindow && !(hour >= 20 && hour < 22)) {
    process.stdout.write(JSON.stringify({ success: true, skipped: true, reason: 'outside_refresh_window', bjtHour: hour }, null, 2))
    return
  }

  const codes = getLowVolSupportedIndexCodes()
  const startDate = ymd8YearsAgoJan1(15)
  const endDate = ymd8Of(new Date())
  const startedAt = Date.now()

  logEvent({ type: 'start', codes: codes.length, startDate, endDate, ignoreWindow })

  const results: Array<{ code: string; ok: boolean; error?: string }> = []
  for (let idx = 0; idx < codes.length; idx += 1) {
    const code = codes[idx]
    const t0 = Date.now()
    logEvent({ type: 'index_start', idx: idx + 1, total: codes.length, code })
    try {
      await refreshOne(code, startDate, endDate)
      results.push({ code, ok: true })
      logEvent({ type: 'index_done', idx: idx + 1, total: codes.length, code, ok: true, ms: Date.now() - t0 })
      await sleep(350 + Math.floor(Math.random() * 450))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isWafError(e)) {
        logEvent({ type: 'index_retry', idx: idx + 1, total: codes.length, code, ok: false, error: msg })
        await sleep(900 + Math.floor(Math.random() * 800))
        try {
          await refreshOne(code, startDate, endDate)
          results.push({ code, ok: true })
          logEvent({ type: 'index_done', idx: idx + 1, total: codes.length, code, ok: true, ms: Date.now() - t0, retried: true })
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
  process.stdout.write(JSON.stringify({ success: fail === 0, ok, fail, startDate, endDate, results }, null, 2))
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(msg)
  process.exit(1)
})
