import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DataStatusBanner from '@/components/DataStatusBanner'
import { type SortDir } from '@/components/SortableTh'
import Top100FilterBar from '@/components/Top100FilterBar'
import Top100Table from '@/components/Top100Table'
import Top100InsightPanel from '@/components/Top100InsightPanel'
import MarketLiquidityPanel from '@/components/MarketLiquidityPanel'
import LowVolOpportunityPanel from '@/components/LowVolOpportunityPanel'
import ValueTimingPanel from '../components/ValueTimingPanel'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import {
  type EtfTopRow,
  type Top100Meta,
  fetchEtfTop100,
  type Top100SortKey,
} from '@/utils/etfApi'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import { formatYmd, parseIsoToLocal } from '@/utils/format'
import { fetchLowVolSummary, fetchValueTimingSummary } from '@/utils/marketApi'
import { calcLowVolSuggestion, type LowVolSuggestionTone } from '@/utils/lowVolSignal'
import { calcValueTimingSuggestion, type ValueTimingSuggestionTone } from '@/utils/valueTimingSignal'
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

const defaultSort: { key: Top100SortKey; dir: SortDir } = {
  key: 'turnover',
  dir: 'desc',
}

const TOP200_STRATEGY_OPTIONS = MOMENTUM_STRATEGIES.map((strategy) => ({
  value: strategy.id,
  label: strategy.label,
}))

type HomeTab = 'list' | 'insight' | 'liquidity' | 'lowvol' | 'value'

const LOWVOL_INDEX_OPTIONS = [
  {
    code: 'H30269',
    label: '红利低波',
    desc: '从高股息股票中筛选低波动、流动性较好标的，定期调样，兼顾收益与波动控制。',
  },
  {
    code: '399986',
    label: '中证银行',
    desc: '跟踪中证银行主题指数，用于观察银行板块在低波/利差框架下的阶段性机会。',
  },
  {
    code: 'H30022',
    label: '800 银行',
    desc: '跟踪中证800银行指数，用于观察更宽基覆盖下的银行板块表现与择时信号。',
  },
  {
    code: '930740.CSI',
    label: '300 红利低波',
    desc: '基于沪深300成分，从高股息中筛选低波动与流动性较好标的，定期调样。',
  },
  {
    code: '931847.CSI',
    label: '500 红利低波',
    desc: '基于中证500成分，从高股息中筛选低波动与流动性较好标的，定期调样。',
  },
  {
    code: '931848.CSI',
    label: '800 红利低波',
    desc: '基于中证800成分，从高股息中筛选低波动与流动性较好标的，定期调样。',
  },
  { code: '930955', label: '红利低波100', desc: '以高股息为基础，综合低波动与流动性筛选，选取100只成分，定期调样。' },
  {
    code: '932365',
    label: '自由现金流',
    desc: '以自由现金流质量为核心的风格指数，在低波框架下用于观察类债权益机会。',
  },
  {
    code: '932315',
    label: '中证红利质量',
    desc: '在红利基础上叠加质量筛选，在低波框架下用于观察防御型权益机会。',
  },
  {
    code: '932305',
    label: '智选高股息',
    desc: '从沪深市场选取高股息率上市公司证券，反映高股息策略的整体表现。',
  },
  {
    code: '980081',
    label: '国证价值100',
    desc: '价值风格宽基指数，在低波框架下用于观察估值修复与类债权益机会。',
  },
] as const

type LowVolIndexCode = (typeof LOWVOL_INDEX_OPTIONS)[number]['code']
type LowVolBiasBasis = 'sma250' | 'sma60'

const VALUE_INDEX_OPTIONS = [
  {
    code: '932365',
    label: '自由现金流',
    desc: '以自由现金流质量与持续性为核心构建，偏向高现金创造能力公司；用股债利差刻画估值修复空间。',
  },
  {
    code: '932315',
    label: '红利质量',
    desc: '在红利因子上叠加盈利与稳健性质量筛选，强化分红可持续性；用股债利差识别阶段性机会。',
  },
  {
    code: '980081',
    label: '国证价值100',
    desc: '价值风格宽基，聚焦低估值与基本面特征；动态PE历史数据来自touzid（截至2026/4/13），增量来自国证指数官网每日抓取。',
  },
] as const

type ValueIndexCode = (typeof VALUE_INDEX_OPTIONS)[number]['code']

function toneToNavPillCls(tone: LowVolSuggestionTone | ValueTimingSuggestionTone): string {
  if (tone === 'good') return 'border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.12)] text-[#34D399]'
  if (tone === 'bad') return 'border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)] text-[#F87171]'
  if (tone === 'warn') return 'border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.12)] text-[#FBBF24]'
  if (tone === 'neutral') return 'border-[rgba(96,165,250,0.25)] bg-[rgba(96,165,250,0.12)] text-[#60A5FA]'
  return 'border-white/10 bg-white/5 text-[#94A3B8]'
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()

  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
  const debouncedKeyword = useDebouncedValue(keyword, 250)

  const rawTab = searchParams.get('tab')
  const tab: HomeTab =
    rawTab === 'insight' || rawTab === 'list' || rawTab === 'liquidity' || rawTab === 'lowvol' || rawTab === 'value' ? rawTab : 'list'

  const [lowVolIndexCode, setLowVolIndexCode] = useState<LowVolIndexCode>('H30269')
  const [lowVolBiasBasis, setLowVolBiasBasis] = useState<LowVolBiasBasis>('sma250')
  const [isCardsExpanded, setIsCardsExpanded] = useState(true)
  const [lowVolLatestByCode, setLowVolLatestByCode] = useState<
    Record<
      LowVolIndexCode,
      { spreadPctRank10y?: number | null; biasPct3y?: number | null; biasPct3y60?: number | null; dividendYieldPct?: number | null } | null
    >
  >(() => {
    const out = {} as Record<
      LowVolIndexCode,
      { spreadPctRank10y?: number | null; biasPct3y?: number | null; biasPct3y60?: number | null; dividendYieldPct?: number | null } | null
    >
    for (const opt of LOWVOL_INDEX_OPTIONS) out[opt.code] = null
    return out
  })
  const [lowVolIndexSuggestionByCode, setLowVolIndexSuggestionByCode] = useState<
    Record<LowVolIndexCode, { label: string; tone: LowVolSuggestionTone }>
  >(() => {
    const out = {} as Record<LowVolIndexCode, { label: string; tone: LowVolSuggestionTone }>
    for (const opt of LOWVOL_INDEX_OPTIONS) out[opt.code] = { label: '—', tone: 'unknown' }
    return out
  })
  const [lowVolIndexSuggestionLoadingByCode, setLowVolIndexSuggestionLoadingByCode] = useState<
    Record<LowVolIndexCode, boolean>
  >(() => {
    const out = {} as Record<LowVolIndexCode, boolean>
    for (const opt of LOWVOL_INDEX_OPTIONS) out[opt.code] = false
    return out
  })

  const [valueIndexCode, setValueIndexCode] = useState<ValueIndexCode>('932365')
  const [valueBiasBasis, setValueBiasBasis] = useState<'sma250' | 'sma60'>('sma250')
  const [valueLatestByCode, setValueLatestByCode] = useState<
    Record<
      ValueIndexCode,
      { spreadPctRank5y?: number | null; pe?: number | null; earningsYieldPct?: number | null; biasPct3y?: number | null; biasPct3y60?: number | null } | null
    >
  >(() => {
    const out = {} as Record<
      ValueIndexCode,
      { spreadPctRank5y?: number | null; pe?: number | null; earningsYieldPct?: number | null; biasPct3y?: number | null; biasPct3y60?: number | null } | null
    >
    for (const opt of VALUE_INDEX_OPTIONS) out[opt.code] = null
    return out
  })
  const [valueSuggestionByCode, setValueSuggestionByCode] = useState<Record<ValueIndexCode, { label: string; tone: ValueTimingSuggestionTone }>>(() => {
    const out = {} as Record<ValueIndexCode, { label: string; tone: ValueTimingSuggestionTone }>
    for (const opt of VALUE_INDEX_OPTIONS) out[opt.code] = { label: '—', tone: 'unknown' }
    return out
  })
  const [valueSuggestionLoadingByCode, setValueSuggestionLoadingByCode] = useState<Record<ValueIndexCode, boolean>>(() => {
    const out = {} as Record<ValueIndexCode, boolean>
    for (const opt of VALUE_INDEX_OPTIONS) out[opt.code] = false
    return out
  })

  const [sortKey, setSortKey] = useState<Top100SortKey>(
    (searchParams.get('sort') as Top100SortKey) ?? defaultSort.key,
  )
  const [sortDir, setSortDir] = useState<SortDir>(
    (searchParams.get('dir') as SortDir) ?? defaultSort.dir,
  )
  const [selectedStrategyId, setSelectedStrategyId] = useState<MomentumStrategyId>(() =>
    resolveMomentumStrategyId(searchParams.get('strategy') ?? DEFAULT_MOMENTUM_STRATEGY_ID),
  )
  const [selectedSignalFilter, setSelectedSignalFilter] = useState<Top200SignalFilterValue>([])
  const [selectedFreshnessFilter, setSelectedFreshnessFilter] = useState<Top200FreshnessFilterValue>([])
  const [selectedZFilter, setSelectedZFilter] = useState<Top200ZFilterValue>([])

  const [loading, setLoading] = useState(true)
  const [loadingMode, setLoadingMode] = useState<'fetch' | 'refetch' | 'cold'>('fetch')
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [rows, setRows] = useState<EtfTopRow[]>([])
  const metaRef = useRef<Top100Meta | null>(null)

  const [progressToken, setProgressToken] = useState<string | null>(null)
  const [backendProgressText, setBackendProgressText] = useState<string | null>(null)
  const [treatAsRefetch, setTreatAsRefetch] = useState(false)

  const refetchEtaMs = 180_000
  const refetchEtaSeconds = Math.round(refetchEtaMs / 1000)
  const [refetchStartedAt, setRefetchStartedAt] = useState<number | null>(null)
  const [refetchProgressPct, setRefetchProgressPct] = useState<number | null>(null)

  const reqSeqRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    metaRef.current = meta
  }, [meta])


  useEffect(() => {
    if (rawTab === 'rps') {
      nav('/market/rps', { replace: true })
      return
    }
    if (rawTab === 'list' || rawTab === 'insight' || rawTab === 'liquidity' || rawTab === 'lowvol' || rawTab === 'value') return
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'list')
    setSearchParams(next, { replace: true })
  }, [nav, rawTab, searchParams, setSearchParams])

  useEffect(() => {
    if (tab !== 'lowvol') return
    const ac = new AbortController()
    setLowVolIndexSuggestionLoadingByCode((prev) => {
      const next = { ...prev }
      for (const opt of LOWVOL_INDEX_OPTIONS) next[opt.code] = true
      return next
    })
    ;(async () => {
      const r = await fetchLowVolSummary({ signal: ac.signal })
      const latestNext = { ...lowVolLatestByCode }
      const sugNext = { ...lowVolIndexSuggestionByCode }
      const items = r.success === true && Array.isArray(r.data?.items) ? r.data.items : []
      const byCode = new Map<string, { spreadPctRank10y?: number | null; biasPct3y?: number | null; biasPct3y60?: number | null; dividendYieldPct?: number | null } | null>()
      for (const it of items) {
        const code = it && typeof it === 'object' ? (it as { code?: unknown }).code : null
        if (typeof code !== 'string') continue
        const latest = it && typeof it === 'object' ? (it as { latest?: unknown }).latest : null
        if (!latest || typeof latest !== 'object') {
          byCode.set(code, null)
          continue
        }
        const o = latest as Record<string, unknown>
        byCode.set(code, {
          spreadPctRank10y: typeof o.spreadPctRank10y === 'number' ? o.spreadPctRank10y : null,
          biasPct3y: typeof o.biasPct3y === 'number' ? o.biasPct3y : null,
          biasPct3y60: typeof o.biasPct3y60 === 'number' ? o.biasPct3y60 : null,
          dividendYieldPct: typeof o.dividendYieldPct === 'number' ? o.dividendYieldPct : null,
        })
      }

      for (const opt of LOWVOL_INDEX_OPTIONS) {
        const last = byCode.has(opt.code) ? byCode.get(opt.code)! : null
        latestNext[opt.code] = last
        const biasPct = lowVolBiasBasis === 'sma60' ? last?.biasPct3y60 : last?.biasPct3y
        const s = calcLowVolSuggestion({
          spreadPctRank10y: last?.spreadPctRank10y,
          biasPct3y: biasPct,
        })
        sugNext[opt.code] = s
      }

      setLowVolLatestByCode(latestNext)
      setLowVolIndexSuggestionByCode(sugNext)
      setLowVolIndexSuggestionLoadingByCode((prev) => {
        const after = { ...prev }
        for (const opt of LOWVOL_INDEX_OPTIONS) after[opt.code] = false
        return after
      })
    })()
    return () => {
      ac.abort()
      setLowVolIndexSuggestionLoadingByCode((prev) => {
        const after = { ...prev }
        for (const opt of LOWVOL_INDEX_OPTIONS) after[opt.code] = false
        return after
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab !== 'lowvol') return
    const next = { ...lowVolIndexSuggestionByCode }
    for (const opt of LOWVOL_INDEX_OPTIONS) {
      const last = lowVolLatestByCode[opt.code]
      const biasPct = lowVolBiasBasis === 'sma60' ? last?.biasPct3y60 : last?.biasPct3y
      next[opt.code] = calcLowVolSuggestion({
        spreadPctRank10y: last?.spreadPctRank10y,
        biasPct3y: biasPct,
      })
    }
    setLowVolIndexSuggestionByCode(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowVolBiasBasis])

  useEffect(() => {
    if (tab !== 'value') return
    const ac = new AbortController()
    setValueSuggestionLoadingByCode((prev) => {
      const next = { ...prev }
      for (const opt of VALUE_INDEX_OPTIONS) next[opt.code] = true
      return next
    })
    ;(async () => {
      const r = await fetchValueTimingSummary({ signal: ac.signal })
      const latestNext = { ...valueLatestByCode }
      const sugNext = { ...valueSuggestionByCode }
      const items = r.success === true && Array.isArray(r.data?.items) ? r.data.items : []
      const byCode = new Map<
        string,
        { spreadPctRank5y?: number | null; pe?: number | null; earningsYieldPct?: number | null; biasPct3y?: number | null; biasPct3y60?: number | null } | null
      >()
      for (const it of items) {
        const code = it && typeof it === 'object' ? (it as { code?: unknown }).code : null
        if (typeof code !== 'string') continue
        const latest = it && typeof it === 'object' ? (it as { latest?: unknown }).latest : null
        if (!latest || typeof latest !== 'object') {
          byCode.set(code, null)
          continue
        }
        const o = latest as Record<string, unknown>
        byCode.set(code, {
          spreadPctRank5y: typeof o.spreadPctRank5y === 'number' ? o.spreadPctRank5y : null,
          pe: typeof o.pe === 'number' ? o.pe : null,
          earningsYieldPct: typeof o.earningsYieldPct === 'number' ? o.earningsYieldPct : null,
          biasPct3y: typeof o.biasPct3y === 'number' ? o.biasPct3y : null,
          biasPct3y60: typeof o.biasPct3y60 === 'number' ? o.biasPct3y60 : null,
        })
      }
      for (const opt of VALUE_INDEX_OPTIONS) {
        const last = byCode.has(opt.code) ? byCode.get(opt.code)! : null
        latestNext[opt.code] = last
        const biasPct = valueBiasBasis === 'sma60' ? last?.biasPct3y60 : last?.biasPct3y
        sugNext[opt.code] = calcValueTimingSuggestion({ spreadPctRank5y: last?.spreadPctRank5y, biasPct3y: biasPct })
      }
      setValueLatestByCode(latestNext)
      setValueSuggestionByCode(sugNext)
      setValueSuggestionLoadingByCode((prev) => {
        const after = { ...prev }
        for (const opt of VALUE_INDEX_OPTIONS) after[opt.code] = false
        return after
      })
    })()
    return () => {
      ac.abort()
      setValueSuggestionLoadingByCode((prev) => {
        const after = { ...prev }
        for (const opt of VALUE_INDEX_OPTIONS) after[opt.code] = false
        return after
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab !== 'value') return
    const next = { ...valueSuggestionByCode }
    for (const opt of VALUE_INDEX_OPTIONS) {
      const last = valueLatestByCode[opt.code]
      const biasPct = valueBiasBasis === 'sma60' ? last?.biasPct3y60 : last?.biasPct3y
      next[opt.code] = calcValueTimingSuggestion({ spreadPctRank5y: last?.spreadPctRank5y, biasPct3y: biasPct })
    }
    setValueSuggestionByCode(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueBiasBasis])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (keyword.trim()) next.set('q', keyword.trim())
    else next.delete('q')
    next.set('tab', tab)
    next.set('sort', sortKey)
    next.set('dir', sortDir)
    next.set('strategy', selectedStrategyId)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, sortKey, sortDir, selectedStrategyId])

  const runFetch = async (
    seq: number,
    opts?: {
      refreshToken?: string
      mode?: 'fetch' | 'refetch' | 'cold'
      ensureLatest?: boolean
    },
  ) => {
    const mode = opts?.mode ?? (meta ? 'fetch' : 'cold')
    setLoading(true)
    setLoadingMode(mode)
    setError(null)

    const timeoutMs = mode === 'fetch' ? 120_000 : 900_000
    const ac = new AbortController()
    const timeoutId = window.setTimeout(() => ac.abort(), timeoutMs)

    let pToken: string | null = null
    if (mode === 'refetch') {
      pToken = opts?.refreshToken || String(Date.now())
    } else if (mode === 'cold') {
      pToken = String(Date.now())
    } else if (mode === 'fetch' && !meta) {
      pToken = String(Date.now())
    }

    setProgressToken(pToken)
    setBackendProgressText(null)
    setTreatAsRefetch(false)

    if (mode === 'refetch' || mode === 'cold') {
      const startedAt =
        mode === 'refetch' && opts?.refreshToken && /^\d+$/.test(opts.refreshToken)
          ? Number(opts.refreshToken)
          : Date.now()
      setRefetchStartedAt(startedAt)
      setRefetchProgressPct(0)
    }

    try {
      const res = await fetchEtfTop100(
        {
          limit: 200,
          refreshToken: opts?.refreshToken,
          ensureLatest: opts?.ensureLatest || opts?.mode === 'cold',
          progressToken: pToken || undefined,
        },
        ac.signal,
      )

      window.clearTimeout(timeoutId)

      if (!mountedRef.current || seq !== reqSeqRef.current) return

      if (res.success === false) {
        if (res.error === 'unauthorized') {
          nav(`/login?next=${encodeURIComponent('/' + window.location.search)}`, { replace: true })
          return
        }
        setMeta(null)
        setRows([])
        setError(res.message ?? res.error)
        setLoading(false)
        return
      }

      setMeta(res.meta)
      setRows(res.data)
      setLoading(false)
      setProgressToken(null)
      setBackendProgressText(null)
    } catch {
      window.clearTimeout(timeoutId)
      if (!mountedRef.current || seq !== reqSeqRef.current) return
      setMeta(null)
      setRows([])
      setError(ac.signal.aborted ? '请求超时，请稍后重试' : '网络异常或 API 不可用')
      setLoading(false)
      setProgressToken(null)
      setBackendProgressText(null)
    }
  }

  useEffect(() => {
    if (!loading) return
    if (loadingMode !== 'refetch' && loadingMode !== 'cold' && loadingMode !== 'fetch') return
    if (!progressToken) return

    let cancelled = false
    const bootingTimerId = window.setTimeout(() => {
      if (cancelled) return
      setBackendProgressText((prev) => prev || '后端计算启动中…')
    }, 3000)

    const tick = async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/etf/progress?_p=${encodeURIComponent(progressToken)}&_t=${Date.now()}`),
          { cache: 'no-store', credentials: 'include', headers: { ...adminAuthHeaders() } },
        )
        const j = (await res.json()) as unknown
        if (cancelled) return
        if (!j || typeof j !== 'object') return
        const o = j as Record<string, unknown>
        if (o.success !== true) return
        const data = o.data
        if (!data || typeof data !== 'object') return
        const d = data as Record<string, unknown>
        const stage = typeof d.stage === 'string' ? d.stage : null
        const msg = typeof d.message === 'string' ? d.message : null
        const done = typeof d.done === 'number' ? d.done : null
        const total = typeof d.total === 'number' ? d.total : null
        const text =
          msg && done != null && total != null && total > 0
            ? `${msg}：${done}/${total}`
            : msg
        if (text) {
          window.clearTimeout(bootingTimerId)
          setBackendProgressText(text)
        }

        if (stage && stage !== 'start' && stage !== 'ensure_latest' && stage !== 'cache_miss') {
          if (!treatAsRefetch) {
            setTreatAsRefetch(true)
          }
          if (!refetchStartedAt) {
            const startedAt = Date.now()
            setRefetchStartedAt(startedAt)
            setRefetchProgressPct(0)
          }
        }
      } catch {
        return
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 1000)
    return () => {
      cancelled = true
      window.clearTimeout(bootingTimerId)
      window.clearInterval(id)
    }
  }, [loading, loadingMode, progressToken, refetchStartedAt, treatAsRefetch])

  useEffect(() => {
    if (!refetchStartedAt || !loading) return
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - refetchStartedAt
      const pct = Math.min(99, Math.floor((elapsed / refetchEtaMs) * 100))
      setRefetchProgressPct(pct)
    }, 250)
    return () => window.clearInterval(timer)
  }, [loading, refetchEtaMs, refetchStartedAt])

  useEffect(() => {
    if (!refetchStartedAt) return
    if (loading) return
    setRefetchProgressPct(100)
    const t = window.setTimeout(() => {
      setRefetchStartedAt(null)
      setRefetchProgressPct(null)
    }, 800)
    return () => window.clearTimeout(t)
  }, [loading, refetchStartedAt])

  useEffect(() => {
    const seq = ++reqSeqRef.current

    void runFetch(seq, { mode: 'fetch' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const incompleteCount = useMemo(
    () => rows.filter((r) => r.dataStatus !== 'complete').length,
    [rows],
  )

  const onToggleSort = (key: Top100SortKey) => {
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDir('desc')
        return key
      }
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return prev
    })
  }

  const onReset = () => {
    setKeyword('')
    setSortKey(defaultSort.key)
    setSortDir(defaultSort.dir)
    setSelectedStrategyId(DEFAULT_MOMENTUM_STRATEGY_ID)
    setSelectedSignalFilter([])
    setSelectedFreshnessFilter([])
    setSelectedZFilter([])
  }

  const activeMomentumStrategy =
    MOMENTUM_STRATEGIES.find((strategy) => strategy.id === selectedStrategyId) ??
    MOMENTUM_STRATEGIES.find((strategy) => strategy.id === DEFAULT_MOMENTUM_STRATEGY_ID) ??
    MOMENTUM_STRATEGIES[0]

  const signalFilterOptions = useMemo(
    () => buildSignalFilterOptions(rows, selectedStrategyId),
    [rows, selectedStrategyId],
  )

  useEffect(() => {
    if (selectedSignalFilter.length === 0) return
    const allowed = new Set(signalFilterOptions.map((option) => option.value))
    const filtered = selectedSignalFilter.filter((v) => allowed.has(v))
    if (filtered.length !== selectedSignalFilter.length) setSelectedSignalFilter(filtered)
  }, [selectedSignalFilter, signalFilterOptions])

  const filteredRows = useMemo(() => {
    const q = debouncedKeyword.trim().toLowerCase()
    return rows.filter((row) => {
      const keywordMatched =
        !q || row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q)
      return (
        keywordMatched &&
        matchesSignalFilter(row, selectedStrategyId, selectedSignalFilter) &&
        matchesFreshnessFilter(row, selectedStrategyId, selectedFreshnessFilter) &&
        matchesZFilter(row, selectedZFilter)
      )
    })
  }, [
    debouncedKeyword,
    rows,
    selectedStrategyId,
    selectedSignalFilter,
    selectedFreshnessFilter,
    selectedZFilter,
  ])

  const lowVolActiveOpt = LOWVOL_INDEX_OPTIONS.find((x) => x.code === lowVolIndexCode) ?? null
  const showTop200Header = tab === 'list' || tab === 'insight'
  const top200Refetching = (loading && (loadingMode === 'refetch' || treatAsRefetch))
  const top200RightMeta = meta
    ? {
        fetchedAt: meta.cachedAt || meta.fetchedAt,
        dataDate: meta.dataDate,
      }
    : null

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      {showTop200Header ? (
        <>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Top200 ETF 异动监测</h1>
              <div className="mt-1.5 text-[13px] text-[#94A3B8]">仅展示最近一个完整交易日数据；缺失/失败会明确提示且不展示推测值。</div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-right text-xs text-[#A9B6CC]">
                {top200Refetching ? (
                  <div className="space-y-0.5">
                    <div>
                      数据交易日： <span className="text-[#E6EDF7]">查询中</span>
                    </div>
                    <div>
                      快照时间： <span className="text-[#E6EDF7]">查询中</span>
                    </div>
                  </div>
                ) : top200RightMeta ? (
                  <div className="space-y-0.5">
                    <div>
                      数据交易日： <span className="text-[#E6EDF7]">{formatYmd(top200RightMeta.dataDate)}</span>
                    </div>
                    <div>
                      快照时间： <span className="text-[#E6EDF7]">{parseIsoToLocal(top200RightMeta.fetchedAt)}</span>
                    </div>
                  </div>
                ) : (
                  <div>仅展示完整交易日数据</div>
                )}
              </div>

                          </div>
          </div>

          <DataStatusBanner
            loading={loading}
            error={error}
            meta={meta}
            incompleteCount={incompleteCount}
            loadingMode={
              loading
                ? treatAsRefetch
                  ? 'refetch'
                  : loadingMode
                : 'fetch'
            }
            loadingProgressPct={treatAsRefetch || loadingMode === 'cold' ? refetchProgressPct : null}
            loadingEtaSeconds={treatAsRefetch || loadingMode === 'cold' ? refetchEtaSeconds : undefined}
            backendProgressText={backendProgressText}
            onRetry={() => {
              const seq = ++reqSeqRef.current
              void runFetch(seq)
            }}
          />

          {tab === 'list' ? (
            <div className="mt-4">
              <Top100FilterBar
                keyword={keyword}
                onChangeKeyword={setKeyword}
                strategyOptions={TOP200_STRATEGY_OPTIONS}
                selectedStrategy={selectedStrategyId}
                onChangeStrategy={(value) => {
                  setSelectedStrategyId(resolveMomentumStrategyId(value))
                  setSelectedSignalFilter([])
                  setSelectedFreshnessFilter([])
                }}
                signalOptions={signalFilterOptions}
                selectedSignal={selectedSignalFilter}
                onChangeSignal={(value) => setSelectedSignalFilter(value)}
                freshnessOptions={TOP200_FRESHNESS_FILTER_OPTIONS}
                selectedFreshness={selectedFreshnessFilter}
                onChangeFreshness={(value) => setSelectedFreshnessFilter(value)}
                zOptions={TOP200_Z_FILTER_OPTIONS}
                selectedZ={selectedZFilter}
                onChangeZ={(value) => setSelectedZFilter(value)}
                onReset={onReset}
              />
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-[#94A3B8] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-[#E2E8F0]">{activeMomentumStrategy?.label ?? '交易策略'}</span>
                  <span>{activeMomentumStrategy?.selectorDescription ?? '当前策略用于列表交易信号展示与筛选。'}</span>
                </div>
                <div className="font-mono text-[#CBD5E1]">{`结果 ${filteredRows.length} / ${rows.length}`}</div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

        {tab === 'value' ? (
          <>
            <div className="mt-2 pb-3">
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsCardsExpanded(!isCardsExpanded)}
                  className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#E6EDF7] transition-colors"
                >
                  {isCardsExpanded ? (
                    <>
                      收起说明 <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      展开说明 <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {VALUE_INDEX_OPTIONS.map((opt) => {
                  const sug = valueSuggestionByCode[opt.code]
                  const sugLoading = valueSuggestionLoadingByCode[opt.code]
                  const active = opt.code === valueIndexCode
                  const last = valueLatestByCode[opt.code]
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        if (active) return
                        setValueIndexCode(opt.code)
                      }}
                      className={cn(
                        'group flex flex-col gap-2 rounded-2xl border px-3 text-left transition-all',
                        isCardsExpanded ? 'py-2.5' : 'py-1.5',
                        active
                          ? 'border-[rgba(255,87,34,0.55)] bg-[rgba(255,87,34,0.10)] shadow-[0_0_0_1px_rgba(255,87,34,0.18),0_10px_30px_rgba(0,0,0,0.25)]'
                          : 'border-white/10 bg-white/5 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.35)]',
                      )}
                    >
                      <div className="flex w-full flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                'truncate text-sm font-semibold',
                                active ? 'text-white' : 'text-[#E6EDF7] group-hover:text-white',
                              )}
                            >
                              {opt.label}
                            </div>
                            <div className={cn('mt-0.5 font-mono text-[11px]', active ? 'text-[#FFD6C8]' : 'text-[#64748B]')}>
                              {opt.code}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-2 py-[2px] text-[11px] font-medium leading-none',
                                toneToNavPillCls(sugLoading ? 'unknown' : (sug?.tone ?? 'unknown')),
                              )}
                            >
                              {sugLoading ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                              ) : null}
                              {sugLoading ? '—' : (sug?.label ?? '—')}
                            </span>
                            {last?.spreadPctRank5y != null && (
                              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[11px] font-medium leading-none text-[#A9B6CC] font-sans">
                                股债利差分位 {last.spreadPctRank5y.toFixed(0)}
                              </span>
                            )}
                            {last?.earningsYieldPct != null && (
                              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[11px] font-medium leading-none text-[#A9B6CC] font-sans">
                                盈利率 {last.earningsYieldPct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {isCardsExpanded && (
                          <div className="text-[11px] leading-4 text-[#94A3B8] group-hover:text-[#CBD5E1]">
                            {opt.desc}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#050A0B]/80 backdrop-blur-md p-1.5 shadow-2xl shadow-black/50">
              <div className="text-[11px] font-medium text-[#94A3B8] pt-1">BIAS基准</div>
              <div className="flex flex-col gap-1 w-full rounded-xl bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setValueBiasBasis('sma250')}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-center text-xs font-semibold transition',
                    valueBiasBasis === 'sma250'
                      ? 'border-[rgba(255,87,34,0.65)] bg-[rgba(255,87,34,0.18)] text-white shadow-[0_0_0_1px_rgba(255,87,34,0.35),0_0_20px_rgba(255,87,34,0.25)]'
                      : 'border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white',
                  )}
                >
                  SMA250
                </button>
                <button
                  type="button"
                  onClick={() => setValueBiasBasis('sma60')}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-center text-xs font-semibold transition',
                    valueBiasBasis === 'sma60'
                      ? 'border-[rgba(255,87,34,0.65)] bg-[rgba(255,87,34,0.18)] text-white shadow-[0_0_0_1px_rgba(255,87,34,0.35),0_0_20px_rgba(255,87,34,0.25)]'
                      : 'border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white',
                  )}
                >
                  SMA60
                </button>
              </div>
            </div>
          </>
        ) : null}

        {tab === 'lowvol' ? (
          <>
            <div className="mt-2 pb-3">
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsCardsExpanded(!isCardsExpanded)}
                  className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#E6EDF7] transition-colors"
                >
                  {isCardsExpanded ? (
                    <>
                      收起说明 <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      展开说明 <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {LOWVOL_INDEX_OPTIONS.map((opt) => {
                  const sug = lowVolIndexSuggestionByCode[opt.code]
                  const sugLoading = lowVolIndexSuggestionLoadingByCode[opt.code]
                  const active = opt.code === lowVolIndexCode
                  const last = lowVolLatestByCode[opt.code]
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        if (active) return
                        setLowVolIndexCode(opt.code)
                      }}
                      className={cn(
                        'group flex flex-col gap-2 rounded-2xl border px-3 text-left transition-all',
                        isCardsExpanded ? 'py-2.5' : 'py-1.5',
                        active
                          ? 'border-[rgba(255,87,34,0.55)] bg-[rgba(255,87,34,0.10)] shadow-[0_0_0_1px_rgba(255,87,34,0.18),0_10px_30px_rgba(0,0,0,0.25)]'
                          : 'border-white/10 bg-white/5 hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/7 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(0,0,0,0.35)]',
                      )}
                    >
                      <div className="flex w-full flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                'truncate text-sm font-semibold',
                                active ? 'text-white' : 'text-[#E6EDF7] group-hover:text-white',
                              )}
                            >
                              {opt.label}
                            </div>
                            <div
                              className={cn(
                                'mt-0.5 font-mono text-[11px]',
                                active ? 'text-[#FFD6C8]' : 'text-[#64748B]',
                              )}
                            >
                              {opt.code}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-2 py-[2px] text-[11px] font-medium leading-none',
                                toneToNavPillCls(sugLoading ? 'unknown' : (sug?.tone ?? 'unknown')),
                              )}
                            >
                              {sugLoading ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                              ) : null}
                              {sugLoading ? '—' : (sug?.label ?? '—')}
                            </span>
                            {last?.dividendYieldPct != null && (
                              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[11px] font-medium leading-none text-[#A9B6CC] font-sans">
                                股息率 {last.dividendYieldPct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {isCardsExpanded && (
                          <div className="text-[11px] leading-4 text-[#94A3B8] group-hover:text-[#CBD5E1]">
                            {opt.desc}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#050A0B]/80 backdrop-blur-md p-1.5 shadow-2xl shadow-black/50">
              <div className="text-[11px] font-medium text-[#94A3B8] pt-1">BIAS基准</div>
              <div className="flex flex-col gap-1 w-full rounded-xl bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setLowVolBiasBasis('sma250')}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-center text-xs font-semibold transition',
                    lowVolBiasBasis === 'sma250'
                      ? 'border-[rgba(255,87,34,0.65)] bg-[rgba(255,87,34,0.18)] text-white shadow-[0_0_0_1px_rgba(255,87,34,0.35),0_0_20px_rgba(255,87,34,0.25)]'
                      : 'border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white',
                  )}
                >
                  SMA250
                </button>
                <button
                  type="button"
                  onClick={() => setLowVolBiasBasis('sma60')}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-center text-xs font-semibold transition',
                    lowVolBiasBasis === 'sma60'
                      ? 'border-[rgba(255,87,34,0.65)] bg-[rgba(255,87,34,0.18)] text-white shadow-[0_0_0_1px_rgba(255,87,34,0.35),0_0_20px_rgba(255,87,34,0.25)]'
                      : 'border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white',
                  )}
                >
                  SMA60
                </button>
              </div>
            </div>
          </>
        ) : null}

      {tab === 'insight' ? (
        <Top100InsightPanel meta={meta} rows={rows} isHomeLoading={loading} />
      ) : tab === 'liquidity' ? (
        <MarketLiquidityPanel />
      ) : tab === 'value' ? (
        <ValueTimingPanel
          indexCode={valueIndexCode}
          indexLabel={VALUE_INDEX_OPTIONS.find((x) => x.code === valueIndexCode)?.label ?? valueIndexCode}
          indexDesc={VALUE_INDEX_OPTIONS.find((x) => x.code === valueIndexCode)?.desc}
          biasBasis={valueBiasBasis}
        />
      ) : tab === 'lowvol' ? (
        <LowVolOpportunityPanel
          indexCode={lowVolIndexCode}
          indexLabel={lowVolActiveOpt?.label ?? lowVolIndexCode}
          indexDesc={lowVolActiveOpt?.desc}
          biasBasis={lowVolBiasBasis}
        />
      ) : (
        <div className={cn(showTop200Header ? 'mt-4' : '')}>
          <Top100Table
            rows={filteredRows}
            loading={loading}
            error={error}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={onToggleSort}
            strategyId={selectedStrategyId}
          />
        </div>
      )}
    </div>
  )
}
