export type ValueTimingSuggestionTone = 'good' | 'bad' | 'neutral' | 'unknown'

export function calcValueTimingSuggestion(args: { spreadPctRank5y?: number | null }): { label: string; tone: ValueTimingSuggestionTone } {
  const rank = args.spreadPctRank5y
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return { label: '—', tone: 'unknown' }
  if (rank >= 80) return { label: '偏加仓', tone: 'good' }
  if (rank <= 20) return { label: '偏减仓', tone: 'bad' }
  return { label: '观望', tone: 'neutral' }
}

