export type EquityBondPoint = {
  date: string
  pe: number | null
  earningsYield: number | null
  yield10yPct: number | null
  value: number | null
  pct: number | null
}

function toNum(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : null
}

function fillForward(values: Array<number | null>): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  let last: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v != null) last = v
    out[i] = last
  }
  return out
}

function fillLeadingWithFirst(values: Array<number | null>): Array<number | null> {
  let first: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v != null) {
      first = v
      break
    }
  }
  if (first == null) return values
  const out = values.slice()
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] != null) break
    out[i] = first
  }
  return out
}

function rollingPercentilePct(values: Array<number | null>, window: number, minPeriods: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v == null) continue
    const start = Math.max(0, i - window + 1)
    let n = 0
    let less = 0
    let equal = 0
    for (let j = start; j <= i; j += 1) {
      const x = values[j]
      if (x == null) continue
      n += 1
      if (x < v) less += 1
      else if (x === v) equal += 1
    }
    if (n < minPeriods || equal === 0) continue
    const avgRank = less + (equal + 1) / 2
    out[i] = (avgRank / n) * 100
  }
  return out
}

export function buildEquityBondValuePctSeries(input: {
  dates: string[]
  peByDate: Map<string, number>
  yield10yPctByDate: Map<string, number>
}): EquityBondPoint[] {
  const dates = input.dates || []
  const peByDate = input.peByDate
  const yPctByDate = input.yield10yPctByDate

  const pe: Array<number | null> = new Array(dates.length).fill(null)
  const y: Array<number | null> = new Array(dates.length).fill(null)

  for (let i = 0; i < dates.length; i += 1) {
    const d = dates[i]
    pe[i] = peByDate.has(d) ? (toNum(peByDate.get(d)) ?? null) : null
    y[i] = yPctByDate.has(d) ? (toNum(yPctByDate.get(d)) ?? null) : null
  }

  const peF = fillForward(pe)
  const yF = fillForward(y)
  const peFF = fillLeadingWithFirst(peF)
  const yFF = fillLeadingWithFirst(yF)

  const value: Array<number | null> = new Array(dates.length).fill(null)
  const earningsYieldArr: Array<number | null> = new Array(dates.length).fill(null)
  for (let i = 0; i < dates.length; i += 1) {
    const peV = peFF[i]
    const yPct = yFF[i]
    if (peV == null || yPct == null || peV <= 0) {
      value[i] = null
      earningsYieldArr[i] = peV != null && peV > 0 ? 1 / peV : null
      continue
    }
    const earningsYield = 1 / peV
    const bondYield = yPct / 100
    earningsYieldArr[i] = earningsYield
    value[i] = earningsYield - bondYield
  }

  const pct = rollingPercentilePct(value, 1260, 630)

  const out: EquityBondPoint[] = []
  for (let i = 0; i < dates.length; i += 1) {
    out.push({
      date: dates[i],
      pe: peFF[i],
      earningsYield: earningsYieldArr[i],
      yield10yPct: yFF[i],
      value: value[i],
      pct: pct[i],
    })
  }
  return out
}
