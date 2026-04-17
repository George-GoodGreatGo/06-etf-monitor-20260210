import type { IChartApi, ISeriesApi, LogicalRange, Time, UTCTimestamp } from 'lightweight-charts'

export function normalizeTime(t: Time | undefined): UTCTimestamp | null {
  if (t == null) return null
  if (typeof t === 'number') return t as UTCTimestamp
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const year = Number((t as { year: unknown }).year)
    const month = Number((t as { month: unknown }).month)
    const day = Number((t as { day: unknown }).day)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
    const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    return Math.floor(ms / 1000) as UTCTimestamp
  }
  return null
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function hasValidLogicalRange(range: LogicalRange | null | undefined): range is LogicalRange {
  if (!range) return false
  const from = Number((range as { from?: unknown }).from)
  const to = Number((range as { to?: unknown }).to)
  return Number.isFinite(from) && Number.isFinite(to)
}

export function safeSetVisibleLogicalRange(chart: IChartApi | null | undefined, range: LogicalRange | null | undefined): boolean {
  if (!chart || !hasValidLogicalRange(range)) return false
  try {
    chart.timeScale().setVisibleLogicalRange(range)
    return true
  } catch {
    return false
  }
}

export function safeClearCrosshair(chart: IChartApi | null | undefined): boolean {
  if (!chart) return false
  try {
    chart.clearCrosshairPosition()
    return true
  } catch {
    return false
  }
}

export function safeSetCrosshair(
  chart: IChartApi | null | undefined,
  price: number | undefined,
  time: UTCTimestamp | null,
  series: ISeriesApi<'Line', Time> | null | undefined,
): boolean {
  if (!chart || !series || !time || !isFiniteNumber(price)) return false
  try {
    chart.setCrosshairPosition(price, time, series)
    return true
  } catch {
    return false
  }
}
