import { getRiskfree10ySeries, getRiskfree10yValueByDate } from '../lib/riskfree10yService.js'

function addUtcDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

function getUtcWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

async function main() {
  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = addUtcDays(endDate, -180)
  const out = await getRiskfree10ySeries({ startDate, endDate, forceRefresh: true })
  let resolvedDays = 0
  let lookbackResolvedDays = 0
  let unresolvedDays = 0
  let chinamoneyCount = 0
  let pairCount = 0
  let singleCount = 0
  let worldgovernmentbondsCount = 0
  let sampledDays = 0

  for (let i = 0; sampledDays < 90 && i <= 220; i += 1) {
    const date = addUtcDays(endDate, -i)
    const weekday = getUtcWeekday(date)
    if (weekday === 0 || weekday === 6) continue
    sampledDays += 1
    const picked = getRiskfree10yValueByDate({
      date,
      byDate: out.byDate,
      resolved: out.resolved,
      lookbackDays: 7,
    })
    if (picked.valuePct == null) {
      unresolvedDays += 1
      continue
    }
    resolvedDays += 1
    if ((picked.lookbackDaysUsed || 0) > 0) lookbackResolvedDays += 1
    const source = picked.source || ''
    if (source === 'chinamoney') chinamoneyCount += 1
    else if (source === 'worldgovernmentbonds') worldgovernmentbondsCount += 1
    else if (source.includes('+')) pairCount += 1
    else singleCount += 1
  }

  process.stdout.write(
    JSON.stringify(
      {
        startDate,
        endDate,
        resolvedPoints: out.byDate.size,
        last90: {
          sampledDays,
          resolvedDays,
          unresolvedDays,
          lookbackResolvedDays,
          chinamoneyCount,
          worldgovernmentbondsCount,
          pairCount,
          singleCount,
        },
        notes: out.meta.notes.slice(0, 50),
        providerNotes: out.meta.providerNotes.slice(0, 50),
      },
      null,
      2,
    ) + '\n',
  )
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(`smokeRiskfree10y failed: ${msg}\n`)
  process.exitCode = 1
})
