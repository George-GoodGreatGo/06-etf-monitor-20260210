import { fetchLowVolIndexCloseSeries, getLowVolIndexSeries, getLowVolSupportedIndexCodes } from '../lib/lowVol.js'
import { fetchGovBond10yYieldPctByDate } from '../lib/chinamoneyGovBond.js'
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

const yieldYearCache = new Map<number, Map<string, number>>()
const yieldYearFailed = new Set<number>()

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

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : v == null ? NaN : Number(String(v).trim())
  return Number.isFinite(n) ? n : null
}

function ymd10FromYmd8(ymd8: string): string | null {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function ymd8FromYmd10(ymd10: string): string | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s.replace(/-/g, '')
}

function percentileInWindow(values: Array<number | null>, value: number | null, window: number, minPeriods: number): number | null {
  if (value == null) return null
  const slice = values.slice(Math.max(0, values.length - window))
  const arr = slice.filter((x): x is number => x != null && Number.isFinite(x))
  if (arr.length < minPeriods) return null
  let le = 0
  for (const x of arr) if (x <= value) le += 1
  return (le / arr.length) * 100
}

function smaAt(values: number[], endIdx: number, period: number): number | null {
  const start = endIdx - period + 1
  if (start < 0) return null
  let sum = 0
  for (let i = start; i <= endIdx; i += 1) sum += values[i]
  return sum / period
}

function smaNullableAt(values: Array<number | null>, endIdx: number, period: number, minPeriods: number): number | null {
  const start = endIdx - period + 1
  if (start < 0) return null
  let sum = 0
  let cnt = 0
  for (let i = start; i <= endIdx; i += 1) {
    const v = values[i]
    if (v == null) continue
    sum += v
    cnt += 1
  }
  if (cnt < minPeriods) return null
  return sum / cnt
}

async function refreshOneIncrementalCompute(args: {
  code: string
  coldStartStartDate8: string
  endDate8: string
  bufferDays: number
}): Promise<{
  mode: 'cold_start' | 'incremental_compute'
  dataDate: string
  snapshotAt: string
  seriesLen: number
  priRange: string
  triRange: string
}> {
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
    return { mode: 'cold_start', dataDate: dd, snapshotAt, seriesLen: series.length, priRange: `${args.coldStartStartDate8}-${endDate}`, triRange: `${args.coldStartStartDate8}-${endDate}` }
  }

  const lastYmd10 = String(row.data_date || '').trim()
  const startFromLast = ymd8MinusDays(lastYmd10, args.bufferDays)
  const startDate = startFromLast && startFromLast >= args.coldStartStartDate8 ? startFromLast : args.coldStartStartDate8
  const startDate10 = ymd10FromYmd8(startDate)
  if (!startDate10) throw new Error(`bad startDate: ${startDate}`)

  const historyByDate = new Map<string, SeriesPoint>()
  for (const p of history) {
    if (!p || typeof p !== 'object') continue
    const d = String((p as SeriesPoint).date || '')
    if (!d) continue
    historyByDate.set(d, p)
  }

  const historyDates = Array.from(historyByDate.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  if (!historyDates.length) throw new Error(`empty snapshot series: ${code}`)

  const priInc = await fetchLowVolIndexCloseSeries({ code, kind: 'pri', startDate8: startDate, endDate8: endDate })
  const closeByDate = new Map<string, number>()
  for (const d of historyDates) {
    const p = historyByDate.get(d)
    const c = toNum(p ? (p as Record<string, unknown>).close : null)
    if (c != null) closeByDate.set(d, c)
  }
  for (const p of priInc) closeByDate.set(p.date, p.close)

  const allDates = Array.from(closeByDate.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const closes: number[] = allDates.map((d) => closeByDate.get(d) as number)

  const updateStartIdx = allDates.findIndex((d) => d >= startDate10)
  if (updateStartIdx < 0) {
    const dd = allDates[allDates.length - 1]
    const snapshotAt = new Date().toISOString()
    return { mode: 'incremental_compute', dataDate: dd, snapshotAt, seriesLen: historyDates.length, priRange: `${startDate}-${endDate}`, triRange: 'skipped' }
  }

  const lookbackDays = 252
  const dividendSmaPeriod = 250
  const dividendSmaMin = 126
  const triNeedStartIdx = Math.max(0, updateStartIdx - (lookbackDays + dividendSmaPeriod + 30))
  const triStart10 = allDates[triNeedStartIdx]
  const triStart8 = ymd8FromYmd10(triStart10)
  if (!triStart8) throw new Error(`bad triStart: ${triStart10}`)

  const triSeries = await fetchLowVolIndexCloseSeries({ code, kind: 'tri', startDate8: triStart8, endDate8: endDate })
  const triByDate = new Map<string, number>()
  for (const p of triSeries) triByDate.set(p.date, p.close)

  const years = new Set<number>()
  for (let i = Math.max(0, updateStartIdx - 10); i < allDates.length; i += 1) {
    const y = Number(allDates[i].slice(0, 4))
    if (Number.isFinite(y)) years.add(y)
  }
  const yieldByDate = new Map<string, number>()
  for (const y of Array.from(years.values()).sort((a, b) => a - b)) {
    if (yieldYearFailed.has(y)) continue
    const cached = yieldYearCache.get(y)
    if (cached) {
      for (const [k, v] of cached.entries()) yieldByDate.set(k, v)
      continue
    }
    try {
      const m = await fetchGovBond10yYieldPctByDate({ year: y })
      yieldYearCache.set(y, m)
      for (const [k, v] of m.entries()) yieldByDate.set(k, v)
    } catch (e) {
      yieldYearFailed.add(y)
      const msg = e instanceof Error ? e.message : String(e)
      logEvent({ type: 'yield_year_failed', code, year: y, error: msg })
    }
  }

  const dividendPointsRaw: Array<number | null> = new Array(allDates.length).fill(null)
  for (let i = lookbackDays; i < allDates.length; i += 1) {
    if (i < triNeedStartIdx) continue
    const dNow = allDates[i]
    const dThen = allDates[i - lookbackDays]
    const triNow = triByDate.get(dNow)
    const triThen = triByDate.get(dThen)
    const priNow = closes[i]
    const priThen = closes[i - lookbackDays]
    if (triNow == null || triThen == null) continue
    if (!(priNow > 0 && priThen > 0 && triNow > 0 && triThen > 0)) continue
    const divReturn = (triNow / triThen) / (priNow / priThen) - 1
    if (!Number.isFinite(divReturn)) continue
    dividendPointsRaw[i] = priNow * divReturn
  }

  const dividendPointsSma: Array<number | null> = new Array(allDates.length).fill(null)
  for (let i = Math.max(0, triNeedStartIdx); i < allDates.length; i += 1) {
    dividendPointsSma[i] = smaNullableAt(dividendPointsRaw, i, dividendSmaPeriod, dividendSmaMin)
  }

  const dividendYieldPct: Array<number | null> = new Array(allDates.length).fill(null)
  for (let i = Math.max(0, triNeedStartIdx); i < allDates.length; i += 1) {
    const sma = dividendPointsSma[i]
    const priNow = closes[i]
    if (sma == null || !(priNow > 0)) continue
    dividendYieldPct[i] = (sma / priNow) * 100
  }

  const ma60: Array<number | null> = new Array(allDates.length).fill(null)
  const ma250: Array<number | null> = new Array(allDates.length).fill(null)
  for (let i = 0; i < allDates.length; i += 1) {
    ma60[i] = smaAt(closes, i, 60)
    ma250[i] = smaAt(closes, i, 250)
  }
  const bias60: Array<number | null> = new Array(allDates.length).fill(null)
  const bias250: Array<number | null> = new Array(allDates.length).fill(null)
  for (let i = 0; i < allDates.length; i += 1) {
    const c = closes[i]
    const m60 = ma60[i]
    const m250 = ma250[i]
    if (m60 != null && m60 !== 0) bias60[i] = (c - m60) / m60
    if (m250 != null && m250 !== 0) bias250[i] = (c - m250) / m250
  }

  const spreadCorePct: Array<number | null> = new Array(allDates.length).fill(null)
  for (let i = Math.max(0, triNeedStartIdx); i < allDates.length; i += 1) {
    const d = allDates[i]
    const y10 = yieldByDate.get(d)
    const dy = dividendYieldPct[i]
    if (y10 == null || dy == null) continue
    spreadCorePct[i] = dy - y10
  }

  const updatedByDate = new Map<string, SeriesPoint>()
  for (const d of historyDates) {
    const p = historyByDate.get(d)
    if (p) updatedByDate.set(d, { ...p })
  }

  const biasWindow = 1260
  const spreadWindow = 1260
  const minPeriods = 252
  const spreadWindow3y = 756
  for (let i = updateStartIdx; i < allDates.length; i += 1) {
    const d = allDates[i]
    const base = updatedByDate.get(d) ?? ({ date: d } as SeriesPoint)
    base.close = closes[i]
    base.ma60 = ma60[i]
    base.ma250 = ma250[i]
    base.bias60 = bias60[i]
    base.bias250 = bias250[i]

    const biasHist60: Array<number | null> = []
    const biasHist250: Array<number | null> = []
    const spreadHist: Array<number | null> = []
    const spreadHist3y: Array<number | null> = []
    for (let j = Math.max(0, i - biasWindow + 1); j <= i; j += 1) {
      const dj = allDates[j]
      const pj = updatedByDate.get(dj) ?? historyByDate.get(dj) ?? null
      const b60 = j === i ? bias60[i] : toNum(pj ? (pj as Record<string, unknown>).bias60 : null)
      const b250 = j === i ? bias250[i] : toNum(pj ? (pj as Record<string, unknown>).bias250 : null)
      biasHist60.push(b60)
      biasHist250.push(b250)
    }
    for (let j = Math.max(0, i - spreadWindow + 1); j <= i; j += 1) {
      const dj = allDates[j]
      const pj = updatedByDate.get(dj) ?? historyByDate.get(dj) ?? null
      const v = j === i ? spreadCorePct[i] : toNum(pj ? (pj as Record<string, unknown>).spreadRawPct : null)
      spreadHist.push(v)
    }
    for (let j = Math.max(0, i - spreadWindow3y + 1); j <= i; j += 1) {
      const dj = allDates[j]
      const pj = updatedByDate.get(dj) ?? historyByDate.get(dj) ?? null
      const v = j === i ? spreadCorePct[i] : toNum(pj ? (pj as Record<string, unknown>).spreadRawPct : null)
      spreadHist3y.push(v)
    }

    base.biasPct3y60 = percentileInWindow(biasHist60, bias60[i], biasWindow, minPeriods)
    base.biasPct3y = percentileInWindow(biasHist250, bias250[i], biasWindow, minPeriods)
    const dy = dividendYieldPct[i]
    if (dy != null) base.dividendYieldPct = dy
    const y10 = yieldByDate.get(d)
    if (y10 != null) base.yield10yPct = y10
    const sp = spreadCorePct[i]
    if (sp != null) {
      base.spreadRawPct = sp
      base.spreadSmoothPct = sp
      base.spreadPct = sp
      base.spreadPctRank3y = percentileInWindow(spreadHist3y, sp, spreadWindow3y, minPeriods)
      base.spreadPctRank10y = percentileInWindow(spreadHist, sp, spreadWindow, minPeriods)
    }

    updatedByDate.set(d, base)
  }

  let lastValidIdx = -1
  for (let i = allDates.length - 1; i >= 0; i -= 1) {
    if (spreadCorePct[i] != null) {
      lastValidIdx = i
      break
    }
  }
  const endIdx = lastValidIdx >= 0 ? lastValidIdx : allDates.length - 1
  const datesToWrite = allDates.slice(0, endIdx + 1)
  const mergedSeries: SeriesPoint[] = datesToWrite.map(
    (d) => updatedByDate.get(d) ?? historyByDate.get(d) ?? ({ date: d, close: closeByDate.get(d) } as SeriesPoint),
  )
  const dd = datesToWrite[datesToWrite.length - 1]
  const snapshotAt = new Date().toISOString()

  await upsertLowVolIndexSnapshot({
    code,
    data_date: dd,
    snapshot_at: snapshotAt,
    source_type: 'realtime',
    source: 'nightly_incremental_compute',
    notes: [
      'refresh_mode=incremental_compute',
      `buffer_days=${args.bufferDays}`,
      `priRange=${startDate}-${endDate}`,
      `triRange=${triStart8}-${endDate}`,
    ],
    payload: { series: mergedSeries },
  })

  return { mode: 'incremental_compute', dataDate: dd, snapshotAt, seriesLen: mergedSeries.length, priRange: `${startDate}-${endDate}`, triRange: `${triStart8}-${endDate}` }
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
      const r = await refreshOneIncrementalCompute({ code, coldStartStartDate8, endDate8, bufferDays })
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
        priRange: r.priRange,
        triRange: r.triRange,
      })
      await sleep(350 + Math.floor(Math.random() * 450))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isWafError(e)) {
        logEvent({ type: 'index_retry', idx: idx + 1, total: codes.length, code, ok: false, error: msg })
        await sleep(900 + Math.floor(Math.random() * 800))
        try {
          const r = await refreshOneIncrementalCompute({ code, coldStartStartDate8, endDate8, bufferDays })
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
            priRange: r.priRange,
            triRange: r.triRange,
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
