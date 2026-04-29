import { useEffect, useMemo, useState } from 'react'
import Top100FilterBar from '@/components/Top100FilterBar'
import Top100Table from '@/components/Top100Table'
import type { SortDir } from '@/components/SortableTh'
import type { EtfTopRow, Top100SortKey } from '@/utils/etfApi'
import {
  DEFAULT_MOMENTUM_STRATEGY_ID,
  MOMENTUM_STRATEGIES,
  resolveMomentumStrategyId,
  type MomentumStrategyId,
} from '@/utils/momentumStrategies'
import {
  TOP200_FRESHNESS_FILTER_OPTIONS,
  TOP200_Z_FILTER_OPTIONS,
  buildSignalFilterOptions,
  matchesFreshnessFilter,
  matchesSignalFilter,
  matchesZFilter,
  type Top200FreshnessFilterValue,
  type Top200SignalFilterValue,
  type Top200ZFilterValue,
} from '@/utils/top200SignalFilters'

const STRATEGY_OPTIONS = MOMENTUM_STRATEGIES.map((strategy) => ({
  value: strategy.id,
  label: strategy.label,
}))

const MOCK_ROWS: EtfTopRow[] = [
  {
    code: '159915',
    name: '创业板ETF',
    latestTradingDate: '2026-04-24',
    volume: 385_000_000,
    turnover: 2_580_000_000,
    turnoverChangePct1d: 8.46,
    turnoverChangePct7dAvg: 15.27,
    z90: 2.84,
    dataStatus: 'complete',
    momentumSignals: {
      confirmTrail12: {
        signalKey: 'buy',
        signalLabel: '买',
        signalDate: '2026-04-24',
        freshnessBucket: 'today',
        freshnessLabel: '当天',
      },
      baseColorFlip: {
        signalKey: 'buy',
        signalLabel: '买',
        signalDate: '2026-04-24',
        freshnessBucket: 'today',
        freshnessLabel: '当天',
      },
    },
  },
  {
    code: '510300',
    name: '沪深300ETF',
    latestTradingDate: '2026-04-24',
    volume: 246_000_000,
    turnover: 1_860_000_000,
    turnoverChangePct1d: -3.82,
    turnoverChangePct7dAvg: 4.18,
    z90: 2.21,
    dataStatus: 'complete',
    momentumSignals: {
      confirmTrail12: {
        signalKey: 'risk_sell',
        signalLabel: '风控卖',
        signalDate: '2026-04-22',
        freshnessBucket: 'within_3d',
        freshnessLabel: '3日内',
      },
      baseColorFlip: {
        signalKey: 'sell',
        signalLabel: '卖',
        signalDate: '2026-04-23',
        freshnessBucket: 'within_3d',
        freshnessLabel: '3日内',
      },
    },
  },
  {
    code: '512050',
    name: '中证A500ETF',
    latestTradingDate: '2026-04-24',
    volume: 198_000_000,
    turnover: 1_520_000_000,
    turnoverChangePct1d: 1.26,
    turnoverChangePct7dAvg: 7.84,
    z90: 1.78,
    dataStatus: 'complete',
    momentumSignals: {
      confirmTrail12: {
        signalKey: 'sell',
        signalLabel: '卖',
        signalDate: '2026-04-18',
        freshnessBucket: 'within_5d',
        freshnessLabel: '5日内',
      },
      baseColorFlip: {
        signalKey: 'buy',
        signalLabel: '买',
        signalDate: '2026-04-24',
        freshnessBucket: 'today',
        freshnessLabel: '当天',
      },
    },
  },
  {
    code: '159869',
    name: '游戏ETF',
    latestTradingDate: '2026-04-24',
    volume: 126_000_000,
    turnover: 920_000_000,
    turnoverChangePct1d: 0.84,
    turnoverChangePct7dAvg: -1.24,
    z90: 1.12,
    dataStatus: 'complete',
    momentumSignals: {
      confirmTrail12: {
        signalKey: 'buy',
        signalLabel: '买',
        signalDate: '2026-04-10',
        freshnessBucket: 'other',
        freshnessLabel: '其它',
      },
      baseColorFlip: {
        signalKey: 'sell',
        signalLabel: '卖',
        signalDate: '2026-04-09',
        freshnessBucket: 'other',
        freshnessLabel: '其它',
      },
    },
  },
  {
    code: '588000',
    name: '科创50ETF',
    latestTradingDate: '2026-04-24',
    volume: 88_000_000,
    turnover: 640_000_000,
    turnoverChangePct1d: -2.16,
    turnoverChangePct7dAvg: -6.42,
    z90: 0.92,
    dataStatus: 'incomplete',
    momentumSignals: {
      confirmTrail12: {
        signalKey: null,
        signalLabel: null,
        signalDate: null,
        freshnessBucket: null,
        freshnessLabel: null,
      },
      baseColorFlip: {
        signalKey: null,
        signalLabel: null,
        signalDate: null,
        freshnessBucket: null,
        freshnessLabel: null,
      },
    },
  },
]

export default function DevTop200MomentumSignalsMock() {
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<Top100SortKey>('turnover')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedStrategyId, setSelectedStrategyId] = useState<MomentumStrategyId>(DEFAULT_MOMENTUM_STRATEGY_ID)
  const [selectedSignalFilter, setSelectedSignalFilter] = useState<Top200SignalFilterValue>([])
  const [selectedFreshnessFilter, setSelectedFreshnessFilter] = useState<Top200FreshnessFilterValue>([])
  const [selectedZFilter, setSelectedZFilter] = useState<Top200ZFilterValue>([])

  const signalOptions = useMemo(
    () => buildSignalFilterOptions(MOCK_ROWS, selectedStrategyId),
    [selectedStrategyId],
  )
  const activeStrategy =
    MOMENTUM_STRATEGIES.find((strategy) => strategy.id === selectedStrategyId) ??
    MOMENTUM_STRATEGIES[0]

  useEffect(() => {
    if (selectedSignalFilter.length === 0) return
    const allowed = new Set(signalOptions.map((option) => option.value))
    const filtered = selectedSignalFilter.filter((v) => allowed.has(v))
    if (filtered.length !== selectedSignalFilter.length) setSelectedSignalFilter(filtered)
  }, [selectedSignalFilter, signalOptions])

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return MOCK_ROWS.filter((row) => {
      const keywordMatched = !q || row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q)
      return (
        keywordMatched &&
        matchesSignalFilter(row, selectedStrategyId, selectedSignalFilter) &&
        matchesFreshnessFilter(row, selectedStrategyId, selectedFreshnessFilter) &&
        matchesZFilter(row, selectedZFilter)
      )
    })
  }, [keyword, selectedFreshnessFilter, selectedSignalFilter, selectedStrategyId, selectedZFilter])

  function onToggleSort(nextKey: Top100SortKey) {
    if (nextKey === sortKey) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(nextKey)
    setSortDir(nextKey === 'code' || nextKey === 'name' ? 'asc' : 'desc')
  }

  function onReset() {
    setKeyword('')
    setSortKey('turnover')
    setSortDir('desc')
    setSelectedStrategyId(DEFAULT_MOMENTUM_STRATEGY_ID)
    setSelectedSignalFilter([])
    setSelectedFreshnessFilter([])
    setSelectedZFilter([])
  }

  return (
    <main className="min-h-screen bg-[#050A0B] px-4 py-8 text-[#E6EDF7] sm:px-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-4">
        <section className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xl font-semibold tracking-tight text-white">Top200 交易信号 Mock 验收页</div>
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
                <p>该页面用于本地回归“交易策略选择器 + 交易信号列 + 新鲜度列 + Z值筛选”的完整链路，不依赖登录和远端快照。</p>
                <p>样本同时覆盖 `买`、`卖`、`风控卖`、`无信号` 以及两种策略下信号切换差异，便于自动化验证。</p>
              </div>
            </div>
            <div className="min-w-[280px] rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">当前策略</div>
                <div className="font-medium text-[#F8FAFC]">{activeStrategy?.label ?? '—'}</div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">筛选结果</div>
                <div className="font-mono text-[#CBD5E1]">{`${filteredRows.length} / ${MOCK_ROWS.length}`}</div>
              </div>
              <div className="mt-2 text-[#94A3B8]">{activeStrategy?.selectorDescription ?? '—'}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
          <Top100FilterBar
            keyword={keyword}
            onChangeKeyword={setKeyword}
            strategyOptions={STRATEGY_OPTIONS}
            selectedStrategy={selectedStrategyId}
            onChangeStrategy={(value) => {
              setSelectedStrategyId(resolveMomentumStrategyId(value))
              setSelectedSignalFilter([])
              setSelectedFreshnessFilter([])
            }}
            signalOptions={signalOptions}
            selectedSignal={selectedSignalFilter}
            onChangeSignal={setSelectedSignalFilter}
            freshnessOptions={TOP200_FRESHNESS_FILTER_OPTIONS}
            selectedFreshness={selectedFreshnessFilter}
            onChangeFreshness={(value) => setSelectedFreshnessFilter(value)}
            zOptions={TOP200_Z_FILTER_OPTIONS}
            selectedZ={selectedZFilter}
            onChangeZ={(value) => setSelectedZFilter(value)}
            onReset={onReset}
          />
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-[#94A3B8]">
            自动化验证建议用例: `Baseline策略 + 风控卖` 应只保留 `510300`; 切换到 `基础颜色切换 + 买 + 当天` 应命中 `159915` 与 `512050`。
          </div>
        </section>

        <Top100Table
          rows={filteredRows}
          loading={false}
          error={null}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggleSort={onToggleSort}
          strategyId={selectedStrategyId}
          buildRpsAnalysisHref={(row) => `/dev/rps-custom-query-mock?ticker=${encodeURIComponent(row.code)}&strategy=${encodeURIComponent(selectedStrategyId)}`}
        />
      </div>
    </main>
  )
}
