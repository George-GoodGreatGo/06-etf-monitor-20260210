export type LiquidityV5Point = {
  date: string
  close: number
  amount: number | null
  tr: number | null
  northMoney: number | null
  amountPct: number | null
  trPct: number | null
  northPct: number | null
  v5: number | null
}

function parseYmd(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return ''
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return ''
}

function toNum(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : null
}

function rollingPercentilePct(values: Array<number | null>, window = 60, minPeriods = 20): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v == null) {
      out[i] = null
      continue
    }
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
    if (n < minPeriods || equal === 0) {
      out[i] = null
      continue
    }
    const avgRank = less + (equal + 1) / 2
    out[i] = (avgRank / n) * 100
  }
  return out
}

function clip1to100(x: number): number {
  if (x < 1) return 1
  if (x > 100) return 100
  return x
}

function calcV5(amountPct: Array<number | null>, trPct: Array<number | null>, northPct: Array<number | null>): Array<number | null> {
  const out: Array<number | null> = new Array(amountPct.length).fill(null)
  for (let i = 0; i < amountPct.length; i += 1) {
    const a = amountPct[i]
    const t = trPct[i]
    const n = northPct[i]
    if (a == null && t == null && n == null) {
      out[i] = null
      continue
    }
    const xs: number[] = []
    if (a != null) xs.push(clip1to100(a))
    if (t != null) xs.push(clip1to100(t))
    if (n != null) xs.push(clip1to100(n))
    if (xs.length === 0) {
      out[i] = null
      continue
    }
    let sum = 0
    for (const x of xs) sum += Math.log(x)
    out[i] = Math.exp(sum / xs.length)
  }
  return out
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

export function buildLiquidityV5Series(input: {
  hs300: Record<string, unknown>[]
  sh: Record<string, unknown>[]
  sz: Record<string, unknown>[]
  north: Record<string, unknown>[]
}): LiquidityV5Point[] {
  const closeByDate = new Map<string, number>()
  for (const r of input.hs300) {
    const d = parseYmd(r.trade_date)
    const c = toNum(r.close)
    if (d && c != null) closeByDate.set(d, c)
  }

  const amountShByDate = new Map<string, number>()
  const trShByDate = new Map<string, number>()
  for (const r of input.sh) {
    const d = parseYmd(r.trade_date)
    const a = toNum(r.amount)
    const t = toNum(r.tr)
    if (d && a != null) amountShByDate.set(d, a)
    if (d && t != null) trShByDate.set(d, t)
  }

  const amountSzByDate = new Map<string, number>()
  const trSzByDate = new Map<string, number>()
  for (const r of input.sz) {
    const d = parseYmd(r.trade_date)
    const a = toNum(r.amount)
    const t = toNum(r.tr)
    if (d && a != null) amountSzByDate.set(d, a)
    if (d && t != null) trSzByDate.set(d, t)
  }

  const northByDate = new Map<string, number>()
  for (const r of input.north) {
    const d = parseYmd(r.trade_date)
    const n = toNum(r.north_money)
    if (d && n != null) northByDate.set(d, n)
  }

  const dates = Array.from(closeByDate.keys()).sort()
  if (dates.length === 0) return []

  const close: Array<number | null> = []
  const totalAmount: Array<number | null> = []
  const totalTr: Array<number | null> = []
  const north: Array<number | null> = []

  for (const d of dates) {
    close.push(closeByDate.get(d) ?? null)
    const aSh = amountShByDate.get(d)
    const aSz = amountSzByDate.get(d)
    if (aSh == null && aSz == null) totalAmount.push(null)
    else {
      const a = (aSh ?? 0) + (aSz ?? 0)
      totalAmount.push(Number.isFinite(a) ? a : null)
    }

    const tSh = trShByDate.get(d)
    const tSz = trSzByDate.get(d)
    if (tSh == null && tSz == null) totalTr.push(null)
    else {
      const sum = (tSh ?? 0) + (tSz ?? 0)
      const cnt = (tSh == null ? 0 : 1) + (tSz == null ? 0 : 1)
      const t = cnt ? sum / cnt : NaN
      totalTr.push(Number.isFinite(t) ? t : null)
    }

    const n = northByDate.get(d)
    north.push(n == null ? null : n)
  }

  const closeF = fillForward(close)
  const amountF = fillForward(totalAmount)
  const trF = fillForward(totalTr)
  const northF = fillForward(north)

  const amountPct = rollingPercentilePct(amountF, 360, 180)
  const trPct = rollingPercentilePct(trF, 360, 180)
  const northPct = rollingPercentilePct(northF, 360, 180)
  const v5 = calcV5(amountPct, trPct, northPct)

  const out: LiquidityV5Point[] = []
  for (let i = 0; i < dates.length; i += 1) {
    const c = closeF[i]
    if (c == null) continue
    out.push({
      date: dates[i],
      close: c,
      amount: amountF[i],
      tr: trF[i],
      northMoney: northF[i],
      amountPct: amountPct[i],
      trPct: trPct[i],
      northPct: northPct[i],
      v5: v5[i],
    })
  }
  return out
}
