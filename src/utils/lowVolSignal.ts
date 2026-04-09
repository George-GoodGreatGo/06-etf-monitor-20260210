export type LowVolThresh = {
  spreadCheapPctRank10y: number
  spreadExpensivePctRank10y: number
  biasLowPct3y: number
  biasHighPct3y: number
}

export const LOWVOL_THRESH: LowVolThresh = {
  spreadCheapPctRank10y: 80,
  spreadExpensivePctRank10y: 20,
  biasLowPct3y: 20,
  biasHighPct3y: 85,
}

export type LowVolSuggestionTone = 'good' | 'warn' | 'bad' | 'neutral' | 'unknown'

export function getLowVolThresh(indexCode?: string): LowVolThresh {
  void indexCode
  return LOWVOL_THRESH
}

export function calcLowVolSuggestion(args: {
  spreadPctRank10y: number | null | undefined
  biasPct3y: number | null | undefined
  indexCode?: string
  thresh?: LowVolThresh
}): { label: string; tone: LowVolSuggestionTone } {
  const thresh = args.thresh ?? getLowVolThresh(args.indexCode)
  const spread = args.spreadPctRank10y
  const bias = args.biasPct3y
  if (typeof spread !== 'number' || !Number.isFinite(spread)) return { label: '—', tone: 'unknown' }
  const cheap = spread >= thresh.spreadCheapPctRank10y
  const lowBias = typeof bias === 'number' && Number.isFinite(bias) ? bias <= thresh.biasLowPct3y : false
  const highBias = typeof bias === 'number' && Number.isFinite(bias) ? bias >= thresh.biasHighPct3y : false
  if (highBias) return { label: '偏减仓', tone: 'bad' }
  if (cheap && lowBias) return { label: '偏加仓', tone: 'good' }
  if (cheap) return { label: '偏持有', tone: 'warn' }
  return { label: '偏观望', tone: 'neutral' }
}

