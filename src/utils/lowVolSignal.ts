export const LOWVOL_THRESH = {
  spreadCheapPctRank10y: 80,
  spreadExpensivePctRank10y: 20,
  biasLowPct3y: 20,
  biasHighPct3y: 79,
} as const

export type LowVolSuggestionTone = 'good' | 'warn' | 'bad' | 'neutral' | 'unknown'

export function calcLowVolSuggestion(args: {
  spreadPctRank10y: number | null | undefined
  biasPct3y: number | null | undefined
}): { label: string; tone: LowVolSuggestionTone } {
  const spread = args.spreadPctRank10y
  const bias = args.biasPct3y
  if (typeof spread !== 'number' || !Number.isFinite(spread)) return { label: '—', tone: 'unknown' }
  const cheap = spread >= LOWVOL_THRESH.spreadCheapPctRank10y
  const lowBias = typeof bias === 'number' && Number.isFinite(bias) ? bias <= LOWVOL_THRESH.biasLowPct3y : false
  const highBias = typeof bias === 'number' && Number.isFinite(bias) ? bias >= LOWVOL_THRESH.biasHighPct3y : false
  if (highBias) return { label: '偏减仓', tone: 'bad' }
  if (cheap && lowBias) return { label: '偏配置', tone: 'good' }
  if (cheap) return { label: '偏配置', tone: 'warn' }
  return { label: '偏观望', tone: 'neutral' }
}

