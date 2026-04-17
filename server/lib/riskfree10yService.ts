import { fetchChinabond10yRange } from './riskfree10yProviders/chinabond.js'
import { fetchChinamoney10yRange } from './riskfree10yProviders/chinamoney.js'
import { fetchEastmoney10yRange } from './riskfree10yProviders/eastmoney.js'
import { fetchWorldGovernmentBonds10yRange } from './riskfree10yProviders/worldgovernmentbonds.js'
import { addUtcDays, dateRangeDays, normalizeYmd10, type Riskfree10yProviderName, type Riskfree10yProviderResult } from './riskfree10yProviders/shared.js'

export type Riskfree10yResolvedPoint = {
  date: string
  valuePct: number
  source: string
  sourcesUsed: Riskfree10yProviderName[]
  notes: string[]
}

export type Riskfree10ySeriesResult = {
  byDate: Map<string, number>
  resolved: Map<string, Riskfree10yResolvedPoint>
  meta: {
    fetchedAt: string
    notes: string[]
    providerNotes: string[]
  }
}

export type Riskfree10yProbeResult = {
  ok: boolean
  date: string
  matchedDate: string | null
  valuePct: number | null
  source: string | null
  lookbackDaysUsed: number | null
  details: Array<{
    source: Riskfree10yProviderName
    ok: boolean
    latestDate: string | null
    latestValuePct: number | null
    points: number
    error?: string
  }>
  notes: string[]
}

const cache = new Map<string, { expiresAt: number; value: Riskfree10ySeriesResult }>()
const inflight = new Map<string, Promise<Riskfree10ySeriesResult>>()

function todayYmd10(): string {
  return new Date().toISOString().slice(0, 10)
}

function sortAsc(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function absBp(a: number, b: number): number {
  return Math.abs(a - b) * 100
}

function closeWithinBp(a: number | null, b: number | null, bp: number): boolean {
  if (a == null || b == null) return false
  return absBp(a, b) <= bp
}

function pickSecondaryPair(date: string, values: Array<{ source: Riskfree10yProviderName; valuePct: number | null }>): Riskfree10yResolvedPoint | null {
  const candidates = values.filter((it) => it.valuePct != null) as Array<{ source: Riskfree10yProviderName; valuePct: number }>
  let best: { sourcesUsed: [Riskfree10yProviderName, Riskfree10yProviderName]; valuePct: number; spreadBp: number } | null = null
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i]
      const b = candidates[j]
      const spreadBp = absBp(a.valuePct, b.valuePct)
      if (spreadBp > 20) continue
      const pair = {
        sourcesUsed: [a.source, b.source] as [Riskfree10yProviderName, Riskfree10yProviderName],
        valuePct: Number((((a.valuePct + b.valuePct) / 2)).toFixed(6)),
        spreadBp,
      }
      if (!best || pair.spreadBp < best.spreadBp) best = pair
    }
  }
  if (!best) return null
  return {
    date,
    valuePct: best.valuePct,
    source: best.sourcesUsed.join('+'),
    sourcesUsed: best.sourcesUsed,
    notes: ['rule=secondary_pair_avg'],
  }
}

function pickLatestPoint(result: Riskfree10yProviderResult): { latestDate: string | null; latestValuePct: number | null } {
  const dates = sortAsc(result.points.keys())
  const latestDate = dates.length ? dates[dates.length - 1] : null
  const latestPoint = latestDate ? result.points.get(latestDate) : null
  return {
    latestDate,
    latestValuePct: latestPoint?.valuePct ?? null,
  }
}

export function resolveRiskfree10ySeries(input: {
  startDate: string
  endDate: string
  sources: Partial<Record<Riskfree10yProviderName, Map<string, number>>>
}): { byDate: Map<string, number>; resolved: Map<string, Riskfree10yResolvedPoint>; notes: string[] } {
  const allDates = dateRangeDays(input.startDate, input.endDate)
  const byDate = new Map<string, number>()
  const resolved = new Map<string, Riskfree10yResolvedPoint>()
  const notes: string[] = []
  let prevAccepted: number | null = null

  for (const date of allDates) {
    const chinamoney = input.sources.chinamoney?.get(date) ?? null
    const chinabond = input.sources.chinabond?.get(date) ?? null
    const eastmoney = input.sources.eastmoney?.get(date) ?? null
    const worldgovernmentbonds = input.sources.worldgovernmentbonds?.get(date) ?? null
    const validCount = [chinamoney, chinabond, eastmoney, worldgovernmentbonds].filter((v) => typeof v === 'number' && Number.isFinite(v)).length

    if (closeWithinBp(chinamoney, chinabond, 20) || closeWithinBp(chinamoney, eastmoney, 20) || closeWithinBp(chinamoney, worldgovernmentbonds, 20)) {
      const point: Riskfree10yResolvedPoint = {
        date,
        valuePct: chinamoney as number,
        source: 'chinamoney',
        sourcesUsed: [
          'chinamoney',
          ...(closeWithinBp(chinamoney, chinabond, 20) ? ['chinabond' as const] : []),
          ...(closeWithinBp(chinamoney, eastmoney, 20) ? ['eastmoney' as const] : []),
          ...(closeWithinBp(chinamoney, worldgovernmentbonds, 20) ? ['worldgovernmentbonds' as const] : []),
        ],
        notes: ['rule=primary_confirmed'],
      }
      byDate.set(date, point.valuePct)
      resolved.set(date, point)
      prevAccepted = point.valuePct
      continue
    }

    const secondaryPair = pickSecondaryPair(date, [
      { source: 'chinabond', valuePct: chinabond },
      { source: 'eastmoney', valuePct: eastmoney },
      { source: 'worldgovernmentbonds', valuePct: worldgovernmentbonds },
    ])
    if (secondaryPair) {
      const point = secondaryPair
      byDate.set(date, point.valuePct)
      resolved.set(date, point)
      prevAccepted = point.valuePct
      continue
    }

    if (validCount === 1) {
      const single =
        chinamoney != null ? ({ source: 'chinamoney' as const, valuePct: chinamoney }) : chinabond != null ? ({ source: 'chinabond' as const, valuePct: chinabond }) : eastmoney != null ? ({ source: 'eastmoney' as const, valuePct: eastmoney }) : null
      const singleExtended =
        single || (worldgovernmentbonds != null ? ({ source: 'worldgovernmentbonds' as const, valuePct: worldgovernmentbonds }) : null)
      if (singleExtended) {
        const jumpOk = prevAccepted == null || absBp(prevAccepted, singleExtended.valuePct) <= 50
        if (jumpOk) {
          const point: Riskfree10yResolvedPoint = {
            date,
            valuePct: singleExtended.valuePct,
            source: singleExtended.source,
            sourcesUsed: [singleExtended.source],
            notes: ['rule=single_source_strict'],
          }
          byDate.set(date, point.valuePct)
          resolved.set(date, point)
          prevAccepted = point.valuePct
        } else {
          notes.push(`reject=${date}:single_source_jump_gt_50bp:${singleExtended.source}`)
        }
      }
      continue
    }

    if (validCount > 1) {
      notes.push(`reject=${date}:multi_source_disagree`)
    }
  }

  return { byDate, resolved, notes }
}

async function fetchProviderMaps(startDate: string, endDate: string) {
  const settled = await Promise.allSettled([
    fetchChinamoney10yRange({ startDate, endDate }),
    fetchChinabond10yRange({ startDate, endDate }),
    fetchEastmoney10yRange({ startDate, endDate }),
    fetchWorldGovernmentBonds10yRange({ startDate, endDate }),
  ])

  const providerResults: Partial<Record<Riskfree10yProviderName, Riskfree10yProviderResult>> = {}
  const providerNotes: string[] = []
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      providerResults[item.value.source] = item.value
      providerNotes.push(...item.value.notes)
    } else {
      providerNotes.push(`provider_error=${String(item.reason instanceof Error ? item.reason.message : item.reason).slice(0, 240)}`)
    }
  }
  return { providerResults, providerNotes }
}

export async function getRiskfree10ySeries(args: {
  startDate: string
  endDate: string
  forceRefresh?: boolean
}): Promise<Riskfree10ySeriesResult> {
  const startDate = normalizeYmd10(args.startDate)
  const endDate = normalizeYmd10(args.endDate)
  if (!startDate || !endDate || startDate > endDate) throw new Error('bad riskfree10y date range')
  const cacheKey = `${startDate}:${endDate}`
  if (!args.forceRefresh) {
    const hit = cache.get(cacheKey)
    if (hit && hit.expiresAt > Date.now()) return hit.value
  }
  const existing = inflight.get(cacheKey)
  if (existing) return await existing

  const task = (async () => {
    const { providerResults, providerNotes } = await fetchProviderMaps(startDate, endDate)
    const resolved = resolveRiskfree10ySeries({
      startDate,
      endDate,
      sources: {
        chinamoney: new Map(Array.from(providerResults.chinamoney?.points || []).map(([date, point]) => [date, point.valuePct])),
        chinabond: new Map(Array.from(providerResults.chinabond?.points || []).map(([date, point]) => [date, point.valuePct])),
        eastmoney: new Map(Array.from(providerResults.eastmoney?.points || []).map(([date, point]) => [date, point.valuePct])),
        worldgovernmentbonds: new Map(Array.from(providerResults.worldgovernmentbonds?.points || []).map(([date, point]) => [date, point.valuePct])),
      },
    })
    const out: Riskfree10ySeriesResult = {
      byDate: resolved.byDate,
      resolved: resolved.resolved,
      meta: {
        fetchedAt: new Date().toISOString(),
        notes: resolved.notes,
        providerNotes,
      },
    }
    cache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60_000, value: out })
    return out
  })().finally(() => inflight.delete(cacheKey))

  inflight.set(cacheKey, task)
  return await task
}

export function getRiskfree10yValueByDate(args: {
  date: string
  byDate: Map<string, number>
  resolved?: Map<string, Riskfree10yResolvedPoint>
  lookbackDays?: number
}): { valuePct: number | null; matchedDate: string | null; lookbackDaysUsed: number | null; source: string | null } {
  const date = normalizeYmd10(args.date)
  const lookbackDays = Math.max(0, Math.min(14, Math.floor(args.lookbackDays ?? 7)))
  if (!date) return { valuePct: null, matchedDate: null, lookbackDaysUsed: null, source: null }
  for (let i = 0; i <= lookbackDays; i += 1) {
    const candidate = i === 0 ? date : addUtcDays(date, -i)
    if (!candidate) continue
    const valuePct = args.byDate.get(candidate)
    if (typeof valuePct !== 'number' || !Number.isFinite(valuePct)) continue
    const source = args.resolved?.get(candidate)?.source ?? null
    return { valuePct, matchedDate: candidate, lookbackDaysUsed: i, source }
  }
  return { valuePct: null, matchedDate: null, lookbackDaysUsed: null, source: null }
}

export async function probeRiskfree10y(args?: {
  date?: string
  forceRefresh?: boolean
}): Promise<Riskfree10yProbeResult> {
  const date = normalizeYmd10(args?.date || todayYmd10()) || todayYmd10()
  const startDate = addUtcDays(date, -14) || date
  const { providerResults, providerNotes } = await fetchProviderMaps(startDate, date)
  const series = resolveRiskfree10ySeries({
    startDate,
    endDate: date,
    sources: {
      chinamoney: new Map(Array.from(providerResults.chinamoney?.points || []).map(([d, point]) => [d, point.valuePct])),
      chinabond: new Map(Array.from(providerResults.chinabond?.points || []).map(([d, point]) => [d, point.valuePct])),
      eastmoney: new Map(Array.from(providerResults.eastmoney?.points || []).map(([d, point]) => [d, point.valuePct])),
      worldgovernmentbonds: new Map(Array.from(providerResults.worldgovernmentbonds?.points || []).map(([d, point]) => [d, point.valuePct])),
    },
  })
  const picked = getRiskfree10yValueByDate({
    date,
    byDate: series.byDate,
    resolved: series.resolved,
    lookbackDays: 7,
  })
  const details: Riskfree10yProbeResult['details'] = []
  for (const source of ['chinamoney', 'chinabond', 'eastmoney', 'worldgovernmentbonds'] as const) {
    const item = providerResults[source]
    if (!item) {
      details.push({ source, ok: false, latestDate: null, latestValuePct: null, points: 0, error: 'provider_failed' })
      continue
    }
    const latest = pickLatestPoint(item)
    details.push({
      source,
      ok: item.points.size > 0,
      latestDate: latest.latestDate,
      latestValuePct: latest.latestValuePct,
      points: item.points.size,
    })
  }
  return {
    ok: picked.valuePct != null,
    date,
    matchedDate: picked.matchedDate,
    valuePct: picked.valuePct,
    source: picked.source,
    lookbackDaysUsed: picked.lookbackDaysUsed,
    details,
    notes: [...providerNotes, ...series.notes],
  }
}
