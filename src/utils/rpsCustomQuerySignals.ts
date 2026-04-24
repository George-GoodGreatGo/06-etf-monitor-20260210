export type MomentumSignalMode = 'default' | 'conservative'

export type MomentumSignalPoint = {
  time: number
  date: string
  targetCloseQfq: number
  scorePct: number | null
  sma20: number | null
  sma60: number | null
  sma250: number | null
  rsi14: number | null
  macdDiff: number | null
  macdDea: number | null
  macdHist: number | null
}

export type MomentumSignalCondition = {
  key: string
  label: string
  passed: boolean
}

export type MomentumSignalState = {
  time: number
  date: string
  price: number
  tone: MomentumPriceTone
  previousTone: MomentumPriceTone | null
  negativeStreak: number
  arrow: 'buy' | 'sell' | null
  buyTriggered: boolean
  sellTriggered: boolean
  buyEligible: boolean
  sellEligible: boolean
  stopTriggered: boolean
  inPositionAfterClose: boolean
  mode: MomentumSignalMode
  modeLabel: string
  buyConditions: MomentumSignalCondition[]
  sellConditions: MomentumSignalCondition[]
}

export type MomentumPriceTone = 'negative' | 'neutral' | 'positive' | 'strong'

const DEFAULT_BUY_RSI_MIN = 50
const DEFAULT_BUY_RSI_MAX = 75
const DEFAULT_SELL_RSI_MAX = 45
const DEFAULT_SELL_NEGATIVE_DAYS = 2

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function resolveMomentumSignalModeLabel(mode: MomentumSignalMode): string {
  return mode === 'conservative' ? '保守模式' : '默认模式'
}

export function resolveMomentumPriceTone(score: number | null | undefined): MomentumPriceTone {
  if (!isFiniteNumber(score)) return 'neutral'
  if (score < 0) return 'negative'
  if (score <= 10) return 'neutral'
  if (score <= 20) return 'positive'
  return 'strong'
}

function passBuyMacd(point: MomentumSignalPoint): boolean {
  return isFiniteNumber(point.macdDiff) && isFiniteNumber(point.macdDea) && isFiniteNumber(point.macdHist)
    ? point.macdDiff > point.macdDea && point.macdHist > 0
    : false
}

function passSellMacd(point: MomentumSignalPoint): boolean {
  return isFiniteNumber(point.macdDiff) && isFiniteNumber(point.macdDea) ? point.macdDiff < point.macdDea : false
}

function buildBuyConditions(
  point: MomentumSignalPoint,
  previousTone: MomentumPriceTone | null,
  mode: MomentumSignalMode,
): MomentumSignalCondition[] {
  const tone = resolveMomentumPriceTone(point.scorePct)
  const aboveSma250 = isFiniteNumber(point.sma250) && point.targetCloseQfq >= point.sma250
  const aboveSma20 = isFiniteNumber(point.sma20) && point.targetCloseQfq >= point.sma20
  const sma20AboveSma60 =
    isFiniteNumber(point.sma20) && isFiniteNumber(point.sma60) ? point.sma20 >= point.sma60 : false
  const passRsi =
    isFiniteNumber(point.rsi14) && point.rsi14 >= DEFAULT_BUY_RSI_MIN && point.rsi14 <= DEFAULT_BUY_RSI_MAX

  const conditions: MomentumSignalCondition[] = [
    { key: 'toneTransition', label: 'Score 由绿转黄', passed: previousTone === 'negative' && tone === 'neutral' },
    { key: 'aboveSma250', label: '收盘价 >= SMA250', passed: aboveSma250 },
    { key: 'macdBull', label: 'MACD 多头（DIFF > DEA 且柱体 > 0）', passed: passBuyMacd(point) },
    { key: 'rsiWindow', label: 'RSI(14) 位于 50~75', passed: passRsi },
  ]

  if (mode === 'conservative') {
    conditions.push({ key: 'aboveSma20', label: '收盘价 >= SMA20', passed: aboveSma20 })
    conditions.push({ key: 'sma20AboveSma60', label: 'SMA20 >= SMA60', passed: sma20AboveSma60 })
  }

  return conditions
}

function buildSellConditions(
  point: MomentumSignalPoint,
  negativeStreak: number,
): { conditions: MomentumSignalCondition[]; stopTriggered: boolean } {
  const belowSma250 = isFiniteNumber(point.sma250) && point.targetCloseQfq < point.sma250
  const tone = resolveMomentumPriceTone(point.scorePct)
  const toneConfirmed = tone === 'negative' && negativeStreak >= DEFAULT_SELL_NEGATIVE_DAYS
  const passRsi = isFiniteNumber(point.rsi14) && point.rsi14 <= DEFAULT_SELL_RSI_MAX
  const passMacd = passSellMacd(point)

  return {
    stopTriggered: belowSma250,
    conditions: [
      { key: 'belowSma250', label: '收盘价 < SMA250（风控）', passed: belowSma250 },
      { key: 'toneConfirmed', label: 'Score 连续 2 日为绿', passed: toneConfirmed },
      { key: 'sellRsi', label: 'RSI(14) <= 45', passed: passRsi },
      { key: 'sellMacd', label: 'DIFF < DEA', passed: passMacd },
    ],
  }
}

export function buildMomentumSignalStates(
  points: MomentumSignalPoint[],
  mode: MomentumSignalMode,
): MomentumSignalState[] {
  const states: MomentumSignalState[] = []
  let negativeStreak = 0
  let inPosition = false

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    const prevPoint = index > 0 ? points[index - 1] : null
    const previousTone = prevPoint ? resolveMomentumPriceTone(prevPoint.scorePct) : null
    const tone = resolveMomentumPriceTone(point.scorePct)

    if (tone === 'negative') negativeStreak += 1
    else negativeStreak = 0

    const buyConditions = buildBuyConditions(point, previousTone, mode)
    const buyEligible = buyConditions.every((condition) => condition.passed)
    const { conditions: sellConditions, stopTriggered } = buildSellConditions(point, negativeStreak)
    const toneSellConfirmed =
      sellConditions.find((condition) => condition.key === 'toneConfirmed')?.passed === true &&
      sellConditions.find((condition) => condition.key === 'sellRsi')?.passed === true &&
      sellConditions.find((condition) => condition.key === 'sellMacd')?.passed === true
    const sellEligible = stopTriggered || toneSellConfirmed

    let arrow: 'buy' | 'sell' | null = null
    if (!inPosition && buyEligible) {
      arrow = 'buy'
      inPosition = true
    } else if (inPosition && sellEligible) {
      arrow = 'sell'
      inPosition = false
    }

    states.push({
      time: point.time,
      date: point.date,
      price: point.targetCloseQfq,
      tone,
      previousTone,
      negativeStreak,
      arrow,
      buyTriggered: arrow === 'buy',
      sellTriggered: arrow === 'sell',
      buyEligible,
      sellEligible,
      stopTriggered,
      inPositionAfterClose: inPosition,
      mode,
      modeLabel: resolveMomentumSignalModeLabel(mode),
      buyConditions,
      sellConditions,
    })
  }

  return states
}
