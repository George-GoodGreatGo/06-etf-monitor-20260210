import type { EtfTopRow } from '@/utils/etfApi'
import type { MomentumStrategyId } from '@/utils/momentumStrategies'
import type { MomentumSignalFreshnessBucket, MomentumSignalSnapshot } from '@/utils/momentumSignalSnapshot'

export type FilterOption = {
  value: string
  label: string
}

export type Top200SignalFilterValue = string
export type Top200FreshnessFilterValue = 'all' | 'none' | MomentumSignalFreshnessBucket
export type Top200ZFilterValue = 'all' | 'z_ge_258' | 'z_196_258' | 'z_165_196' | 'z_lt_165_or_missing'

const SIGNAL_LABEL_ORDER: Record<string, number> = {
  buy: 1,
  sell: 2,
  risk_sell: 3,
}

export const TOP200_FRESHNESS_FILTER_OPTIONS: readonly FilterOption[] = [
  { value: 'all', label: '全部新鲜度' },
  { value: 'today', label: '当天' },
  { value: 'within_3d', label: '3日内' },
  { value: 'within_5d', label: '5日内' },
  { value: 'other', label: '其它' },
  { value: 'none', label: '无信号' },
]

export const TOP200_Z_FILTER_OPTIONS: readonly FilterOption[] = [
  { value: 'all', label: '全部Z值' },
  { value: 'z_ge_258', label: '|Z|>=2.58' },
  { value: 'z_196_258', label: '1.96<=|Z|<2.58' },
  { value: 'z_165_196', label: '1.65<=|Z|<1.96' },
  { value: 'z_lt_165_or_missing', label: '<1.65或缺失' },
]

export function getRowMomentumSignal(row: EtfTopRow, strategyId: MomentumStrategyId): MomentumSignalSnapshot | null {
  const raw = row.momentumSignals?.[strategyId]
  return raw && typeof raw === 'object' ? raw : null
}

export function buildSignalFilterOptions(rows: EtfTopRow[], strategyId: MomentumStrategyId): FilterOption[] {
  const unique = new Map<string, { signalKey: string; signalLabel: string }>()
  let hasNone = false
  for (const row of rows) {
    const snapshot = getRowMomentumSignal(row, strategyId)
    if (!snapshot?.signalLabel || !snapshot.signalKey) {
      hasNone = true
      continue
    }
    unique.set(snapshot.signalKey, {
      signalKey: snapshot.signalKey,
      signalLabel: snapshot.signalLabel,
    })
  }
  const options: FilterOption[] = [{ value: 'all', label: '全部信号' }]
  const sorted = [...unique.values()].sort((a, b) => {
    const ao = SIGNAL_LABEL_ORDER[a.signalKey] ?? 999
    const bo = SIGNAL_LABEL_ORDER[b.signalKey] ?? 999
    if (ao !== bo) return ao - bo
    return a.signalLabel.localeCompare(b.signalLabel, 'zh-CN')
  })
  for (const item of sorted) {
    options.push({ value: item.signalKey, label: item.signalLabel })
  }
  if (hasNone) options.push({ value: 'none', label: '无信号' })
  return options
}

export function matchesSignalFilter(row: EtfTopRow, strategyId: MomentumStrategyId, value: Top200SignalFilterValue): boolean {
  if (value === 'all') return true
  const snapshot = getRowMomentumSignal(row, strategyId)
  if (value === 'none') return !snapshot?.signalKey
  return snapshot?.signalKey === value
}

export function matchesFreshnessFilter(row: EtfTopRow, strategyId: MomentumStrategyId, value: Top200FreshnessFilterValue): boolean {
  if (value === 'all') return true
  const snapshot = getRowMomentumSignal(row, strategyId)
  if (value === 'none') return !snapshot?.freshnessBucket
  return snapshot?.freshnessBucket === value
}

export function matchesZFilter(row: EtfTopRow, value: Top200ZFilterValue): boolean {
  if (value === 'all') return true
  const absZ = typeof row.z90 === 'number' && Number.isFinite(row.z90) ? Math.abs(row.z90) : null
  if (value === 'z_ge_258') return absZ != null && absZ >= 2.58
  if (value === 'z_196_258') return absZ != null && absZ >= 1.96 && absZ < 2.58
  if (value === 'z_165_196') return absZ != null && absZ >= 1.65 && absZ < 1.96
  return absZ == null || absZ < 1.65
}
