export type ValueTimingSuggestionTone = 'good' | 'bad' | 'warn' | 'neutral' | 'unknown'

export function calcValueTimingSuggestion(args: { spreadPctRank5y?: number | null; biasPct3y?: number | null }): { label: string; tone: ValueTimingSuggestionTone } {
  const rank = args.spreadPctRank5y
  const bias = args.biasPct3y
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return { label: '—', tone: 'unknown' }
  if (typeof bias === 'number' && Number.isFinite(bias) && bias >= 85) return { label: '偏减仓', tone: 'bad' }
  if (rank >= 80 && typeof bias === 'number' && Number.isFinite(bias) && bias <= 20) return { label: '偏加仓', tone: 'good' }
  if (rank >= 80) return { label: '偏持有', tone: 'warn' }
  return { label: '偏观望', tone: 'neutral' }
}
