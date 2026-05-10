import type { RpsStyleSeriesPoint } from '@/utils/marketApi'
import type { MomentumStrategyId, MomentumStrategySignalPreset } from '@/utils/momentumStrategies'

export type MomentumSignalFreshnessBucket = 'today' | 'within_3d' | 'within_5d' | 'other'

export type MomentumSignalSnapshot = {
  signalKey: string | null
  signalLabel: string | null
  signalDate: string | null
  freshnessBucket: MomentumSignalFreshnessBucket | null
  freshnessLabel: string | null
}

export type MomentumSignalsByStrategy = Partial<Record<MomentumStrategyId, MomentumSignalSnapshot>>

type PreparedMomentumPoint = {
  date: string
  targetCloseQfq: number
  scorePct: number | null
  sma20: number | null
  sma250: number | null
  rsi14: number | null
  macdHist: number | null
  macdDiff: number | null
  macdDea: number | null
  atr14: number | null
  targetHighQfq: number
  targetLowQfq: number
}

type MomentumSignalEvent = {
  date: string
  signalKey: string
  signalLabel: string
}

type PriceTone = 'negative' | 'neutral' | 'positive' | 'strong'

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function buildSma(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

function buildEma(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length < window) return out
  let sum = 0
  for (let i = 0; i < window; i += 1) sum += values[i]
  let ema = sum / window
  out[window - 1] = ema
  const multiplier = 2 / (window + 1)
  for (let i = window; i < values.length; i += 1) {
    ema = (values[i] - ema) * multiplier + ema
    out[i] = ema
  }
  return out
}

function buildMacd(
  values: number[],
  shortPeriod: number,
  longPeriod: number,
  signalPeriod: number,
): Array<{ diff: number | null; dea: number | null; hist: number | null }> {
  const shortEma = buildEma(values, shortPeriod)
  const longEma = buildEma(values, longPeriod)
  const out = values.map(() => ({ diff: null, dea: null, hist: null }))
  const diffValues = values.map((_, index) => {
    const shortValue = shortEma[index]
    const longValue = longEma[index]
    if (!isFiniteNumber(shortValue) || !isFiniteNumber(longValue)) return null
    return shortValue - longValue
  })
  const multiplier = 2 / (Math.max(1, Math.floor(signalPeriod)) + 1)
  let dea: number | null = null
  for (let i = 0; i < diffValues.length; i += 1) {
    const diff = diffValues[i]
    if (!isFiniteNumber(diff)) continue
    dea = dea == null ? diff : (diff - dea) * multiplier + dea
    out[i] = { diff, dea, hist: diff - dea }
  }
  return out
}

function computeRsiValue(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50
  if (avgLoss === 0) return 100
  if (avgGain === 0) return 0
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function buildRsi(values: number[], period: number): Array<number | null> {
  const window = Math.max(1, Math.floor(period))
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (values.length <= window) return out

  let gains = 0
  let losses = 0
  for (let i = 1; i <= window; i += 1) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }
  let avgGain = gains / window
  let avgLoss = losses / window
  out[window] = computeRsiValue(avgGain, avgLoss)

  for (let i = window + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (window - 1) + gain) / window
    avgLoss = (avgLoss * (window - 1) + loss) / window
    out[i] = computeRsiValue(avgGain, avgLoss)
  }

  return out
}

function resolvePriceTone(score: number | null | undefined): PriceTone {
  if (!isFiniteNumber(score)) return 'neutral'
  if (score < 0) return 'negative'
  if (score <= 10) return 'neutral'
  if (score <= 20) return 'positive'
  return 'strong'
}

function buildConfirmSellReasons(point: PreparedMomentumPoint): string[] {
  const reasons: string[] = []
  if (isFiniteNumber(point.sma20) && point.targetCloseQfq < point.sma20) reasons.push('close<SMA20')
  if (isFiniteNumber(point.macdHist) && point.macdHist < 0) reasons.push('MACD Hist<0')
  if (isFiniteNumber(point.rsi14) && point.rsi14 < 50) reasons.push('RSI<50')
  return reasons
}

function prepareMomentumPoints(series: RpsStyleSeriesPoint[]): PreparedMomentumPoint[] {
  const cleaned = series.filter(
    (point) =>
      point &&
      typeof point.date === 'string' &&
      isFiniteNumber(point.targetCloseQfq),
  )
  const priceValues = cleaned.map((point) => point.targetCloseQfq)
  const highs = cleaned.map((point) => (point as any).targetHighQfq ?? point.targetCloseQfq)
  const lows = cleaned.map((point) => (point as any).targetLowQfq ?? point.targetCloseQfq)
  const sma20 = buildSma(priceValues, 20)
  const sma250 = buildSma(priceValues, 250)
  const rsi14 = buildRsi(priceValues, 14)
  const macd = buildMacd(priceValues, 8, 21, 5)
  const atrValues = priceValues.map((_, idx) => {
    if (idx === 0) return 0
    return Math.max(
      highs[idx] - lows[idx],
      Math.abs(highs[idx] - priceValues[idx - 1]),
      Math.abs(lows[idx] - priceValues[idx - 1]),
    )
  })
  const atr14 = buildSma(atrValues, 14)
  return cleaned.map((point, index) => ({
    date: point.date,
    targetCloseQfq: point.targetCloseQfq,
    scorePct: isFiniteNumber(point.scorePct) ? point.scorePct : null,
    sma20: sma20[index] ?? null,
    sma250: sma250[index] ?? null,
    rsi14: rsi14[index] ?? null,
    macdHist: macd[index]?.hist ?? null,
    macdDiff: macd[index]?.diff ?? null,
    macdDea: macd[index]?.dea ?? null,
    atr14: atr14[index] ?? null,
    targetHighQfq: highs[index],
    targetLowQfq: lows[index],
  }))
}

function buildConfirmTrail12Events(points: PreparedMomentumPoint[]): MomentumSignalEvent[] {
  if (points.length < 2) return []
  const events: MomentumSignalEvent[] = []
  let inPosition = false
  let highestCloseSinceEntry = 0
  for (let i = 1; i < points.length; i += 1) {
    const prevPoint = points[i - 1]
    const point = points[i]
    const prevTone = resolvePriceTone(prevPoint.scorePct)
    const tone = resolvePriceTone(point.scorePct)
    const aboveSma250 = isFiniteNumber(point.sma250) && point.targetCloseQfq >= point.sma250

    if (!inPosition && prevTone === 'negative' && tone === 'neutral' && aboveSma250) {
      events.push({ date: point.date, signalKey: 'buy', signalLabel: '买' })
      inPosition = true
      highestCloseSinceEntry = point.targetCloseQfq
      continue
    }

    if (!inPosition) continue
    highestCloseSinceEntry = Math.max(highestCloseSinceEntry, point.targetCloseQfq)
    const confirmSellReasons = prevTone === 'neutral' && tone === 'negative' ? buildConfirmSellReasons(point) : []
    const hitRiskSell = highestCloseSinceEntry > 0 && point.targetCloseQfq <= highestCloseSinceEntry * 0.88
    if (!confirmSellReasons.length && !hitRiskSell) continue

    events.push({
      date: point.date,
      signalKey: hitRiskSell ? 'risk_sell' : 'sell',
      signalLabel: hitRiskSell ? '风控卖' : '卖',
    })
    inPosition = false
    highestCloseSinceEntry = 0
  }
  return events
}

function buildBaseColorFlipEvents(points: PreparedMomentumPoint[]): MomentumSignalEvent[] {
  if (points.length < 2) return []
  const events: MomentumSignalEvent[] = []
  let inPosition = false
  for (let i = 1; i < points.length; i += 1) {
    const prevTone = resolvePriceTone(points[i - 1].scorePct)
    const tone = resolvePriceTone(points[i].scorePct)
    if (!inPosition && prevTone === 'negative' && tone === 'neutral') {
      events.push({ date: points[i].date, signalKey: 'buy', signalLabel: '买' })
      inPosition = true
      continue
    }
    if (!inPosition) continue
    if (prevTone === 'neutral' && tone === 'negative') {
      events.push({ date: points[i].date, signalKey: 'sell', signalLabel: '卖' })
      inPosition = false
    }
  }
  return events
}

function buildBaselineEnhancedEvents(points: PreparedMomentumPoint[]): MomentumSignalEvent[] {
  if (points.length < 2) return []
  const events: MomentumSignalEvent[] = []
  let inPosition = false
  let highestCloseSinceEntry = 0
  let entryPrice = 0
  let blockUntilIndex = -1
  for (let i = 1; i < points.length; i += 1) {
    const prevPoint = points[i - 1]
    const point = points[i]
    const prevTone = resolvePriceTone(prevPoint.scorePct)
    const tone = resolvePriceTone(point.scorePct)
    const aboveSma250 = isFiniteNumber(point.sma250) && point.targetCloseQfq >= point.sma250

    if (!inPosition && prevTone === 'negative' && tone === 'neutral' && aboveSma250) {
      if (i <= blockUntilIndex) continue
      events.push({ date: point.date, signalKey: 'buy', signalLabel: '买' })
      inPosition = true
      highestCloseSinceEntry = point.targetCloseQfq
      entryPrice = point.targetCloseQfq
      continue
    }

    if (!inPosition) continue
    highestCloseSinceEntry = Math.max(highestCloseSinceEntry, point.targetCloseQfq)
    const currentReturn = entryPrice > 0 ? (point.targetCloseQfq / entryPrice - 1) : 0

    const hitHardStop = currentReturn <= -0.07
    const hitAtrStop = isFiniteNumber(point.atr14) && point.atr14 > 0
      && point.targetCloseQfq <= highestCloseSinceEntry - 3 * point.atr14
    const hitTrailing12 = point.targetCloseQfq <= highestCloseSinceEntry * 0.88
    const hitSma250 = isFiniteNumber(point.sma250) && point.targetCloseQfq < point.sma250
    const confirmSellReasons = prevTone === 'neutral' && tone === 'negative' ? buildConfirmSellReasons(point) : []
    const isRisk = hitHardStop || hitAtrStop || hitTrailing12 || hitSma250
    const hasConfirm = confirmSellReasons.length > 0
    if (!isRisk && !hasConfirm) continue

    events.push({
      date: point.date,
      signalKey: isRisk ? 'risk_sell' : 'sell',
      signalLabel: isRisk ? '风控卖' : '卖',
    })
    inPosition = false
    highestCloseSinceEntry = 0
    entryPrice = 0
    if (hitHardStop || hitAtrStop) blockUntilIndex = i + 10
  }
  return events
}

function buildTradeSignalEvents(
  points: PreparedMomentumPoint[],
  signalPreset: MomentumStrategySignalPreset,
): MomentumSignalEvent[] {
  if (signalPreset === 'baseColorFlip') return buildBaseColorFlipEvents(points)
  if (signalPreset === 'baselineEnhanced') return buildBaselineEnhancedEvents(points)
  return buildConfirmTrail12Events(points)
}

function resolveFreshnessBucket(tradingDaysAgo: number): MomentumSignalFreshnessBucket {
  if (tradingDaysAgo <= 0) return 'today'
  if (tradingDaysAgo <= 2) return 'within_3d'
  if (tradingDaysAgo <= 5) return 'within_5d'
  return 'other'
}

export function formatMomentumFreshnessLabel(bucket: MomentumSignalFreshnessBucket | null | undefined): string | null {
  if (bucket === 'today') return '当天'
  if (bucket === 'within_3d') return '3日内'
  if (bucket === 'within_5d') return '5日内'
  if (bucket === 'other') return '其它'
  return null
}

export function computeMomentumSignalSnapshot(args: {
  series: RpsStyleSeriesPoint[]
  signalPreset: MomentumStrategySignalPreset
  referenceDate?: string | null
}): MomentumSignalSnapshot {
  const points = prepareMomentumPoints(args.series)
  if (!points.length) {
    return {
      signalKey: null,
      signalLabel: null,
      signalDate: null,
      freshnessBucket: null,
      freshnessLabel: null,
    }
  }
  const events = buildTradeSignalEvents(points, args.signalPreset)
  const current = events.length ? events[events.length - 1] : null
  if (!current) {
    return {
      signalKey: null,
      signalLabel: null,
      signalDate: null,
      freshnessBucket: null,
      freshnessLabel: null,
    }
  }
  const tradingDates = points.map((point) => point.date)
  const requestedReferenceDate = String(args.referenceDate || '').trim()
  const referenceIndex = requestedReferenceDate ? tradingDates.lastIndexOf(requestedReferenceDate) : -1
  const latestIndex = referenceIndex >= 0 ? referenceIndex : tradingDates.length - 1
  const signalIndex = tradingDates.lastIndexOf(current.date)
  const tradingDaysAgo = signalIndex >= 0 ? latestIndex - signalIndex : latestIndex
  const freshnessBucket = resolveFreshnessBucket(Math.max(0, tradingDaysAgo))
  return {
    signalKey: current.signalKey,
    signalLabel: current.signalLabel,
    signalDate: current.date,
    freshnessBucket,
    freshnessLabel: formatMomentumFreshnessLabel(freshnessBucket),
  }
}

export function buildMomentumSignalsByStrategy(args: {
  series: RpsStyleSeriesPoint[]
  strategies: ReadonlyArray<{ id: MomentumStrategyId; signalPreset: MomentumStrategySignalPreset }>
  referenceDate?: string | null
}): MomentumSignalsByStrategy {
  const out: MomentumSignalsByStrategy = {}
  for (const strategy of args.strategies) {
    out[strategy.id] = computeMomentumSignalSnapshot({
      series: args.series,
      signalPreset: strategy.signalPreset,
      referenceDate: args.referenceDate,
    })
  }
  return out
}
