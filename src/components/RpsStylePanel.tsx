import { useEffect, useMemo, useRef, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import FloatingSectionNav, { type FloatingNavSection } from '@/components/FloatingSectionNav'
import RpsCustomQueryCharts from '@/components/charts/RpsCustomQueryCharts'
import RpsStyleChart from '@/components/charts/RpsStyleChart'
import { cn } from '@/lib/utils'
import {
  fetchRpsCustomQuery,
  fetchRpsStyleMatrix,
  fetchRpsStylePanel,
  fetchRpsStyleSeries,
  fetchRpsStyleSummary,
  fetchRpsTurnoverHistory,
  fetchRpsTurnoverSummary,
  type RpsCustomQueryData,
  type RpsStyleMatrixItem,
  type RpsStyleSeriesPoint,
  type RpsTurnoverHistoryData,
  type RpsTurnoverSummaryItem,
} from '@/utils/marketApi'
import type { Top100Meta } from '@/utils/etfApi'
import { formatCompactNumber, formatYmd } from '@/utils/format'

const DEFAULT_TICKERS = ['159915.SZ', '588000.SH', '513180.SH', '510300.SH', '512050.SH', '560010.SH']
const TURNOVER_TICKERS = ['512890.SH', ...DEFAULT_TICKERS]
const RPS_BENCHMARK_CODE = 'H30269'
const RPS_BENCHMARK_NAME = '红利低波全收益指数'
const ETF_NAME_MAP: Record<string, string> = {
  '512890.SH': '红利低波ETF',
  '159915.SZ': '创业板ETF',
  '588000.SH': '科创50ETF',
  '513180.SH': '恒生科技ETF',
  '510300.SH': '沪深300ETF',
  '512050.SH': '中证A500ETF',
  '560010.SH': '中证1000ETF',
}
const RANGE_OPTIONS = [
  { key: '1w', label: '最近1周' },
  { key: '2w', label: '最近2周' },
  { key: '1m', label: '最近1个月' },
  { key: '3m', label: '最近3个月' },
  { key: '6m', label: '最近6个月' },
  { key: '1y', label: '最近1年' },
  { key: '2y', label: '最近2年' },
  { key: '3y', label: '最近3年' },
  { key: '5y', label: '最近5年' },
  { key: 'ytd', label: '年初至今' },
  { key: 'custom', label: '自定义起点日期' },
] as const
const RPS_METRIC_DISPLAY_DIGITS = 6
let customQueryRequestSeq = 0

const RPS_OVERVIEW_NAV_SECTIONS: FloatingNavSection[] = [
  { id: 'rps-score-section', label: 'Score截面', shortLabel: 'Score截面' },
  { id: 'rps-trend-section', label: '动量', shortLabel: '动量' },
  { id: 'rps-turnover-section', label: '成交额', shortLabel: '成交额' },
] as const

type RpsPage = 'overview' | 'custom-query'
type RpsViewMode = 'raw' | 'relative' | 'score'
type RpsRangeKey = (typeof RANGE_OPTIONS)[number]['key']

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime())
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

function addYears(base: Date, years: number): Date {
  const d = new Date(base.getTime())
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d
}

function clampStartDate(start: string, end: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return end
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return start
  return start > end ? end : start
}

function resolveDateRange(rangeKey: RpsRangeKey, customStartDate: string): { startDate: string; endDate: string } {
  const end = new Date()
  const endDate = ymd(end)
  if (rangeKey === 'custom') return { startDate: clampStartDate(customStartDate, endDate), endDate }
  if (rangeKey === '1w') return { startDate: ymd(addDays(end, -7)), endDate }
  if (rangeKey === '2w') return { startDate: ymd(addDays(end, -14)), endDate }
  if (rangeKey === '1m') return { startDate: ymd(addMonths(end, -1)), endDate }
  if (rangeKey === '3m') return { startDate: ymd(addMonths(end, -3)), endDate }
  if (rangeKey === '6m') return { startDate: ymd(addMonths(end, -6)), endDate }
  if (rangeKey === '1y') return { startDate: ymd(addYears(end, -1)), endDate }
  if (rangeKey === '2y') return { startDate: ymd(addYears(end, -2)), endDate }
  if (rangeKey === '3y') return { startDate: ymd(addYears(end, -3)), endDate }
  if (rangeKey === '5y') return { startDate: ymd(addYears(end, -5)), endDate }
  return { startDate: `${endDate.slice(0, 4)}-01-01`, endDate }
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

function fmtTurnover(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return formatCompactNumber(v)
}

function fmtMultiple(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)}x`
}

function fmtTradingDaysAgo(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return '—'
  return `${v}个交易日前`
}

function buildCustomQueryRequestId(): string {
  customQueryRequestSeq += 1
  return `custom-query-${Date.now()}-${customQueryRequestSeq}`
}

function formatEtfDisplayLabel(args: {
  ticker?: string | null
  code?: string | null
  name?: string | null
  fallback?: string | null
}): string {
  const ticker = String(args.ticker || '').trim()
  const code = String(args.code || '').trim() || (ticker.includes('.') ? ticker.split('.')[0] || ticker : ticker)
  const fallback = String(args.fallback || '').trim()
  const rawName = String(args.name || '')
    .replace(/\s+/g, ' ')
    .trim()
  const name = rawName && rawName !== code && rawName !== ticker ? rawName : ''
  if (name && code) return `${name}（${code}）`
  if (code) return code
  if (name) return name
  return fallback || '—'
}

function resolveScoreState(score: number | null | undefined): { label: string; toneCls: string; valueCls: string } {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return {
      label: '暂无判定',
      toneCls: 'border-white/10 bg-white/5 text-[#94A3B8]',
      valueCls: 'text-[#F8FAFC]',
    }
  }
  if (score > 0) {
    return {
      label: '强于MA50',
      toneCls: 'border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.12)] text-[#34D399]',
      valueCls: 'text-[#34D399]',
    }
  }
  if (score < 0) {
    return {
      label: '弱于MA50',
      toneCls: 'border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)] text-[#F87171]',
      valueCls: 'text-[#F87171]',
    }
  }
  return {
    label: '贴近MA50',
    toneCls: 'border-[rgba(148,163,184,0.25)] bg-[rgba(148,163,184,0.10)] text-[#CBD5E1]',
    valueCls: 'text-[#F8FAFC]',
  }
}

export default function RpsStylePanel({ page }: { page: RpsPage }) {
  const isOverviewPage = page === 'overview'
  const isCustomQueryPage = page === 'custom-query'

  const [loading, setLoading] = useState(isOverviewPage)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [chartView, setChartView] = useState<RpsViewMode>('score')
  const [rangeKey, setRangeKey] = useState<RpsRangeKey>('1y')
  const [customStartDateDraft, setCustomStartDateDraft] = useState<string>(() => ymd(addYears(new Date(), -1)))
  const [customStartDateApplied, setCustomStartDateApplied] = useState<string | null>(null)
  const [mode, setMode] = useState<'risk_on' | 'risk_off'>('risk_off')
  const [leaderTicker, setLeaderTicker] = useState<string | null>(null)
  const [items, setItems] = useState<RpsStyleMatrixItem[]>([])
  const [seriesByTicker, setSeriesByTicker] = useState<Record<string, RpsStyleSeriesPoint[]>>({})
  const [enabledTickers, setEnabledTickers] = useState<Record<string, boolean>>({})
  const [turnoverTicker, setTurnoverTicker] = useState<string>('512890.SH')
  const [turnoverLoading, setTurnoverLoading] = useState(false)
  const [turnoverError, setTurnoverError] = useState<string | null>(null)
  const [turnoverData, setTurnoverData] = useState<RpsTurnoverHistoryData | null>(null)
  const [turnoverSummaryLoading, setTurnoverSummaryLoading] = useState(false)
  const [turnoverSummaryError, setTurnoverSummaryError] = useState<string | null>(null)
  const [turnoverSummaryItems, setTurnoverSummaryItems] = useState<RpsTurnoverSummaryItem[]>([])
  const [customTickerInput, setCustomTickerInput] = useState<string>('159915')
  const [submittedCustomTicker, setSubmittedCustomTicker] = useState<string>('159915')
  const [customQueryRequestId, setCustomQueryRequestId] = useState<string>(() => buildCustomQueryRequestId())
  const [customQueryLoading, setCustomQueryLoading] = useState(isCustomQueryPage)
  const [customQueryError, setCustomQueryError] = useState<string | null>(null)
  const [customQueryMeta, setCustomQueryMeta] = useState<Top100Meta | null>(null)
  const [customQueryData, setCustomQueryData] = useState<RpsCustomQueryData | null>(null)
  const latestCustomQueryRequestIdRef = useRef(customQueryRequestId)

  const resolvedRange = useMemo(
    () => resolveDateRange(rangeKey, customStartDateApplied || ymd(addYears(new Date(), -1))),
    [rangeKey, customStartDateApplied],
  )
  const controlsDisabled = loading
  const anchorStyle = useMemo(() => ({ scrollMarginTop: '104px' }), [])
  const customQueryLatest = customQueryData?.latest ?? null
  const customQueryScoreState = useMemo(() => resolveScoreState(customQueryLatest?.scorePct), [customQueryLatest?.scorePct])

  useEffect(() => {
    if (!isOverviewPage) return
    if (chartView === 'relative' && rangeKey === 'custom' && !customStartDateApplied) return

    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const panelRes = await fetchRpsStylePanel({
          ...(chartView === 'relative'
            ? {
                startDate: resolvedRange.startDate,
                endDate: resolvedRange.endDate,
              }
            : {}),
          signal: ac.signal,
        })

        if (panelRes.success === true) {
          const sum = panelRes.data.summary
          const matrix = panelRes.data.matrix
          setMeta(panelRes.meta || null)
          setMode(sum.mode)
          setLeaderTicker(sum.leaderTicker)
          const matrixItems = Array.isArray(matrix.items) ? matrix.items : []
          setItems(matrixItems)
          const tickers = matrixItems.length ? matrixItems.map((x) => x.ticker) : DEFAULT_TICKERS
          setEnabledTickers((prev) => {
            const next: Record<string, boolean> = {}
            for (const ticker of tickers) next[ticker] = prev[ticker] ?? true
            return next
          })
          const byTicker: Record<string, RpsStyleSeriesPoint[]> = {}
          for (const ticker of tickers) {
            const series = panelRes.data.seriesByTicker?.[ticker]
            byTicker[ticker] = Array.isArray(series) ? series : []
          }
          setSeriesByTicker(byTicker)
          setLoading(false)
          return
        }

        const [sumRes, matrixRes] = await Promise.all([
          fetchRpsStyleSummary({ signal: ac.signal }),
          fetchRpsStyleMatrix({ signal: ac.signal }),
        ])
        if (sumRes.success !== true) {
          setError(sumRes.message || panelRes.message || '获取RPS摘要失败')
          setLoading(false)
          return
        }
        if (matrixRes.success !== true) {
          setError(matrixRes.message || panelRes.message || '获取RPS矩阵失败')
          setLoading(false)
          return
        }

        setMeta(matrixRes.meta || null)
        setMode(sumRes.data.mode)
        setLeaderTicker(sumRes.data.leaderTicker)
        const matrixItems = Array.isArray(matrixRes.data.items) ? matrixRes.data.items : []
        setItems(matrixItems)
        const tickers = matrixItems.length ? matrixItems.map((x) => x.ticker) : DEFAULT_TICKERS
        setEnabledTickers((prev) => {
          const next: Record<string, boolean> = {}
          for (const ticker of tickers) next[ticker] = prev[ticker] ?? true
          return next
        })

        const all = await Promise.all(
          tickers.map((ticker) =>
            fetchRpsStyleSeries({
              ticker,
              ...(chartView === 'relative'
                ? {
                    startDate: resolvedRange.startDate,
                    endDate: resolvedRange.endDate,
                  }
                : {}),
              signal: ac.signal,
            }),
          ),
        )
        const byTicker: Record<string, RpsStyleSeriesPoint[]> = {}
        for (let i = 0; i < tickers.length; i += 1) {
          const result = all[i]
          if (result.success === true && Array.isArray(result.data?.series)) byTicker[tickers[i]] = result.data.series
          else byTicker[tickers[i]] = []
        }
        setSeriesByTicker(byTicker)
        setLoading(false)
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
        setError('网络异常或 API 不可用')
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [chartView, customStartDateApplied, isOverviewPage, rangeKey, resolvedRange.endDate, resolvedRange.startDate])

  useEffect(() => {
    if (!isOverviewPage) return
    const ac = new AbortController()
    ;(async () => {
      setTurnoverSummaryLoading(true)
      setTurnoverSummaryError(null)
      try {
        const res = await fetchRpsTurnoverSummary({ signal: ac.signal })
        if (res.success !== true) {
          setTurnoverSummaryError(res.message || '获取成交额摘要失败')
          setTurnoverSummaryItems([])
          setTurnoverSummaryLoading(false)
          return
        }
        setTurnoverSummaryItems(Array.isArray(res.data?.items) ? res.data.items : [])
        setTurnoverSummaryLoading(false)
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
        setTurnoverSummaryError('网络异常或 API 不可用')
        setTurnoverSummaryItems([])
        setTurnoverSummaryLoading(false)
      }
    })()
    return () => ac.abort()
  }, [isOverviewPage])

  useEffect(() => {
    if (!isOverviewPage) return
    const ac = new AbortController()
    ;(async () => {
      setTurnoverLoading(true)
      setTurnoverError(null)
      setTurnoverData(null)
      try {
        const res = await fetchRpsTurnoverHistory({ ticker: turnoverTicker, signal: ac.signal })
        if (res.success !== true) {
          setTurnoverError(res.message || '获取成交额历史失败')
          setTurnoverData(null)
          setTurnoverLoading(false)
          return
        }
        setTurnoverData(res.data)
        setTurnoverLoading(false)
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
        setTurnoverError('网络异常或 API 不可用')
        setTurnoverData(null)
        setTurnoverLoading(false)
      }
    })()
    return () => ac.abort()
  }, [isOverviewPage, turnoverTicker])

  useEffect(() => {
    if (!isCustomQueryPage) return
    const ac = new AbortController()
    const requestId = customQueryRequestId
    latestCustomQueryRequestIdRef.current = requestId
    ;(async () => {
      setCustomQueryLoading(true)
      setCustomQueryError(null)
      setCustomQueryMeta(null)
      setCustomQueryData(null)
      try {
        const res = await fetchRpsCustomQuery({ ticker: submittedCustomTicker, requestId, signal: ac.signal })
        if (latestCustomQueryRequestIdRef.current !== requestId) return
        if (res.success !== true) {
          setCustomQueryError(res.message || '获取RPS自定义查询失败')
          setCustomQueryLoading(false)
          return
        }
        setCustomQueryMeta(res.meta || null)
        setCustomQueryData(res.data)
        setCustomQueryLoading(false)
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
        if (latestCustomQueryRequestIdRef.current !== requestId) return
        setCustomQueryError('网络异常或 API 不可用')
        setCustomQueryLoading(false)
      }
    })()
    return () => ac.abort()
  }, [customQueryRequestId, isCustomQueryPage, submittedCustomTicker])

  const modeCls = useMemo(() => {
    return mode === 'risk_on'
      ? 'border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.10)] text-[#34D399]'
      : 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] text-[#F87171]'
  }, [mode])

  const turnoverRows = useMemo(() => {
    if (!Array.isArray(turnoverData?.series)) return []
    return [...turnoverData.series].reverse()
  }, [turnoverData])

  const turnoverSummaryRows = useMemo(() => {
    const summaryMap = new Map(turnoverSummaryItems.map((item) => [item.ticker, item]))
    return TURNOVER_TICKERS.map((ticker) => {
      const hit = summaryMap.get(ticker)
      if (hit) return hit
      return {
        ticker,
        code: ticker.split('.')[0] || ticker,
        name: ETF_NAME_MAP[ticker] || ticker,
        latestTradingDate: null,
        latestAmplifiedDate: null,
        tradingDaysAgo: null,
        status: 'no_data' as const,
      }
    })
  }, [turnoverSummaryItems])

  const customTurnoverRows = useMemo(() => {
    if (!Array.isArray(customQueryData?.turnoverSeries)) return []
    return [...customQueryData.turnoverSeries].reverse().slice(0, 250)
  }, [customQueryData])

  const overviewIntro = (
    <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">市场风格 RPS 总览</div>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p><span className="font-medium text-[#CBD5E1]">基准分母</span>：{RPS_BENCHMARK_NAME}（{RPS_BENCHMARK_CODE}）。</p>
            <p><span className="font-medium text-[#CBD5E1]">RPS</span>：目标 ETF 前复权收盘价 / {RPS_BENCHMARK_NAME}收盘价。</p>
            <p><span className="font-medium text-[#CBD5E1]">MA50</span>：RPS 的 50 日简单移动平均线。</p>
            <p><span className="font-medium text-[#CBD5E1]">Score</span>：((RPS / MA50) - 1) × 100%。</p>
            <p><span className="font-medium text-[#CBD5E1]">Score说明</span>：Score 数值较高，说明该标的相对 {RPS_BENCHMARK_NAME} 的近期动量更强；Score 数值较低，说明相对动量偏弱，也可能对应阶段性修复观察窗口。</p>
            <p><span className="font-medium text-[#CBD5E1]">RPS起点归一</span>：按所选起点将各标的 RPS 与 MA50 同步归一化到 1，便于横向比较相对 {RPS_BENCHMARK_NAME} 的变化幅度。</p>
          </div>
        </div>

        <div className="min-w-[300px] rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[#94A3B8]">模式</div>
            <div className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', modeCls)}>
              {mode === 'risk_on' ? '进攻模式' : '防守模式'}
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="text-[#94A3B8]">主攻标的</div>
            <div className="font-mono text-[#E6EDF7]">{leaderTicker ?? '—'}</div>
          </div>
        </div>
      </div>
    </section>
  )

  const customQueryIntro = (
    <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-xl font-semibold tracking-tight text-white">市场风格 RPS 自定义查询</div>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p><span className="font-medium text-[#CBD5E1]">基准分母</span>：{RPS_BENCHMARK_NAME}（{RPS_BENCHMARK_CODE}）。</p>
            <p><span className="font-medium text-[#CBD5E1]">查询能力</span>：输入任意 ETF 代码，查看聚合摘要、三张联动图和最近 250 个交易日成交额追踪。</p>
            <p><span className="font-medium text-[#CBD5E1]">主图增强</span>：前复权价格图叠加 `SMA60`、`SMA250`、Score 阈值分段着色和 `1.50x` 放量黄点。</p>
            <p><span className="font-medium text-[#CBD5E1]">图表口径</span>：保持与原“市场风格RPS”页一致，便于与总览页对照分析。</p>
          </div>
        </div>
      </div>
    </section>
  )

  const turnoverSection = (
    <>
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#F8FAFC]">放量公告板</div>
          <div className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">
            直接汇总各目标 ETF 在最近 90 个交易日内最近一次满足 `成交额较前20日均值 &gt;= 1.50x` 的日期。
          </div>
        </div>
        <div className="text-xs text-[#94A3B8]">口径：以各 ETF 当前最新交易日为基准计算交易日间隔</div>
      </div>

      {turnoverSummaryLoading ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-6 text-center text-sm text-[#94A3B8]">
          正在加载放量摘要...
        </div>
      ) : turnoverSummaryError ? (
        <div className="mt-3 rounded-lg border border-[rgba(248,113,113,0.24)] bg-[rgba(127,29,29,0.20)] px-3 py-6 text-center text-sm text-[#FCA5A5]">
          {turnoverSummaryError}
        </div>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-2.5">
            {turnoverSummaryRows.map((item) => {
              const isSelected = item.ticker === turnoverTicker
              const hasHit = item.status === 'hit'
              const displayCode = item.code || item.ticker.split('.')[0] || item.ticker
              const amplifiedDateText = item.latestAmplifiedDate
                ? formatYmd(item.latestAmplifiedDate)
                : item.status === 'no_data'
                  ? '暂无数据'
                  : '最近90个交易日未出现>=1.50x放量'
              return (
                <button
                  key={item.ticker}
                  type="button"
                  onClick={() => setTurnoverTicker(item.ticker)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-[112px] min-w-0 flex-col justify-between rounded-md border px-2.5 py-2 text-left transition',
                    isSelected
                      ? 'border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.10)] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]'
                      : 'border-white/10 bg-[#0B1220] hover:border-white/20 hover:bg-white/[0.06]',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <div className="truncate text-sm font-semibold leading-5 text-[#E6EDF7]">{item.name}</div>
                      <div className="font-mono text-[11px] leading-5 text-[#94A3B8]">{displayCode}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {hasHit ? (
                        <span className="rounded-full border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.12)] px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-[#FBBF24]">
                          {`${fmtTradingDaysAgo(item.tradingDaysAgo)}放量`}
                        </span>
                      ) : null}
                      {!hasHit && item.status === 'no_data' ? (
                        <span className="text-[11px] leading-4 text-[#94A3B8]">暂无可用成交额数据</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] leading-4.5">
                    <div className={cn('truncate', hasHit ? 'text-[#F8FAFC]' : 'text-[#CBD5E1]')}>
                      最近放量日：{amplifiedDateText}
                    </div>
                    <div className="truncate text-[#94A3B8]">
                      最近交易日：{item.latestTradingDate ? formatYmd(item.latestTradingDate) : '—'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-[#A9B6CC]">
            <tr>
              <th className="px-3 py-2 text-left">日期</th>
              <th className="px-3 py-2 text-right">成交额</th>
              <th className="px-3 py-2 text-right">较前20日均值倍数</th>
            </tr>
          </thead>
          <tbody>
            {turnoverLoading ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-[#94A3B8]">
                  正在加载成交额历史...
                </td>
              </tr>
            ) : turnoverError ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-[#FCA5A5]">
                  {turnoverError}
                </td>
              </tr>
            ) : turnoverRows.length ? (
              turnoverRows.map((row) => {
                const isHot = typeof row.turnoverMultipleOfPrev20Avg === 'number' && row.turnoverMultipleOfPrev20Avg >= 1.5
                return (
                  <tr key={row.date} className={cn('border-t border-white/5', isHot && 'bg-[rgba(251,191,36,0.08)]')}>
                    <td className="px-3 py-2 font-mono text-[#E6EDF7]">{formatYmd(row.date)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#E6EDF7]">{fmtTurnover(row.turnover)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono',
                        isHot ? 'font-semibold text-[#FBBF24]' : 'text-[#A9B6CC]',
                      )}
                    >
                      {fmtMultiple(row.turnoverMultipleOfPrev20Avg)}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-[#94A3B8]">
                  暂无成交额历史
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )

  const customQuerySection = (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#93C5FD]">RPS Custom Query</div>
              <div className="text-lg font-semibold tracking-tight text-[#F8FAFC]">输入 ETF 代码后立即刷新主图、副图与成交额追踪</div>
              <div className="text-sm leading-relaxed text-[#94A3B8]">
                输入示例：`159915`、`159915.SZ`、`510300.SH`。默认聚焦最近 1 年，并沿用 {RPS_BENCHMARK_NAME}（{RPS_BENCHMARK_CODE}）口径。
              </div>
            </div>
            <form
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto"
              onSubmit={(e) => {
                e.preventDefault()
                const nextTicker = customTickerInput.trim().toUpperCase()
                setSubmittedCustomTicker(nextTicker || '159915')
                setCustomQueryRequestId(buildCustomQueryRequestId())
              }}
            >
              <input
                value={customTickerInput}
                onChange={(e) => setCustomTickerInput(e.target.value)}
                placeholder="输入ETF代码，如 159915"
                className="w-full rounded-md border border-[#243041] bg-[#0B1220] px-4 py-3 font-mono text-base text-[#E6EDF7] outline-none focus:border-[#334155] sm:w-[280px] xl:w-[320px]"
              />
              <button
                type="submit"
                disabled={customQueryLoading}
                className="rounded-md border border-[#243041] bg-[#162033] px-5 py-3 text-sm font-medium text-[#E6EDF7] transition hover:border-[#334155] hover:bg-[#1B2940] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {customQueryLoading ? '查询中...' : '提交查询'}
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#93C5FD]">查询结果摘要</div>
              <div className="text-[11px] text-[#64748B]">查询成功后统一汇总核心结果</div>
            </div>
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#93C5FD]">当前标的</div>
                <div className="mt-1 break-all text-sm font-semibold text-[#F8FAFC]">
                  {formatEtfDisplayLabel({
                    ticker: customQueryData?.ticker,
                    code: customQueryData?.code,
                    name: customQueryData?.name,
                    fallback: submittedCustomTicker,
                  })}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#94A3B8]">最新交易日</div>
                <div className="mt-1 font-mono text-sm font-semibold text-[#F8FAFC]">
                  {customQueryLatest?.date ? formatYmd(customQueryLatest.date) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#94A3B8]">最新 Score</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn('font-mono text-sm font-semibold', customQueryScoreState.valueCls)}>
                    {fmt(customQueryLatest?.scorePct, 2)}
                  </span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', customQueryScoreState.toneCls)}>
                    {customQueryScoreState.label}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#94A3B8]">基准分母</div>
                <div className="mt-1 text-sm font-medium text-[#CBD5E1]">
                  {customQueryData?.benchmarkName ?? RPS_BENCHMARK_NAME}
                  <span className="ml-1 font-mono text-[12px] text-[#64748B]">
                    ({customQueryData?.benchmarkTicker ?? RPS_BENCHMARK_CODE})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <DataStatusBanner
            loading={customQueryLoading}
            error={customQueryError}
            meta={customQueryMeta}
            incompleteCount={0}
            onRetry={() => {
              setCustomQueryRequestId(buildCustomQueryRequestId())
            }}
            />
          </div>
        </div>
      </section>

      {customQueryData?.latest ? (
        <>
          <RpsCustomQueryCharts
            ticker={customQueryData.ticker}
            tickerName={customQueryData.name}
            benchmarkName={customQueryData.benchmarkName}
            series={customQueryData.series}
            turnoverSeries={customQueryData.turnoverSeries}
          />

          <section className="overflow-hidden rounded-md border border-[#1E293B] bg-[#0F172A] shadow-lg">
            <div className="border-b border-[#1E293B] px-3 py-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[15px] font-semibold tracking-tight text-white">最近250个交易日成交额追踪</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[#94A3B8]">
                    展示 `交易日`、`当日成交额`、`相对前20个交易日均值倍数`，高于 `1.50x` 的交易日高亮。
                  </div>
                </div>
                <div className="text-xs text-[#94A3B8]">
                  标的：
                  {formatEtfDisplayLabel({
                    ticker: customQueryData.ticker,
                    code: customQueryData.code,
                    name: customQueryData.name,
                  })}
                </div>
              </div>
            </div>

            <div className="px-3 py-3">
              <div className="overflow-x-auto rounded-md border border-[#1E293B] bg-[#0B1220]">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-[#A9B6CC]">
                    <tr>
                      <th className="px-3 py-2 text-left">日期</th>
                      <th className="px-3 py-2 text-right">成交额</th>
                      <th className="px-3 py-2 text-right">较前20日均值倍数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customTurnoverRows.length ? (
                      customTurnoverRows.map((row) => {
                        const isHot = typeof row.turnoverMultipleOfPrev20Avg === 'number' && row.turnoverMultipleOfPrev20Avg >= 1.5
                        return (
                          <tr key={row.date} className={cn('border-t border-[#162033]', isHot && 'bg-[rgba(251,191,36,0.08)]')}>
                            <td className="px-3 py-2 font-mono text-[#E6EDF7]">{formatYmd(row.date)}</td>
                            <td className="px-3 py-2 text-right font-mono text-[#E6EDF7]">{fmtTurnover(row.turnover)}</td>
                            <td
                              className={cn(
                                'px-3 py-2 text-right font-mono',
                                isHot ? 'font-semibold text-[#FBBF24]' : 'text-[#A9B6CC]',
                              )}
                            >
                              {fmtMultiple(row.turnoverMultipleOfPrev20Avg)}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-sm text-[#94A3B8]">
                          暂无成交额历史
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )

  return (
    <div className="relative space-y-4">
      {isOverviewPage ? <FloatingSectionNav sections={RPS_OVERVIEW_NAV_SECTIONS} offsetTop={108} /> : null}

      {isOverviewPage ? overviewIntro : customQueryIntro}

      {isOverviewPage ? (
        <>
          <section
            id="rps-score-section"
            style={anchorStyle}
            className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg"
          >
            <div className="border-b border-white/10 px-4 py-4">
              <div className="text-lg font-semibold tracking-tight text-white">Score 截面数据</div>
              <div className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
                汇总当前观测 ETF 的 RPS、MA50、Score 与趋势方向，用于快速判断相对强弱和当下风格主线。
              </div>
            </div>
            <div className="px-4 py-4">
              <DataStatusBanner
                loading={loading}
                error={error}
                meta={meta}
                incompleteCount={0}
                onRetry={() => {
                  window.location.reload()
                }}
              />

              <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-[#A9B6CC]">
                    <tr>
                      <th className="px-3 py-2 text-left">Ticker / 中文名</th>
                      <th className="px-3 py-2 text-right">RPS</th>
                      <th className="px-3 py-2 text-right">MA50</th>
                      <th className="px-3 py-2 text-right">Score%</th>
                      <th className="px-3 py-2 text-right">趋势</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.ticker} className="border-t border-white/5">
                        <td className="px-3 py-2 text-[#E6EDF7]">
                          <div className="font-mono">{item.ticker}</div>
                          <div className="text-xs text-[#94A3B8]">{ETF_NAME_MAP[item.ticker] || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#E6EDF7]">
                          {fmt(item.rpsRaw, RPS_METRIC_DISPLAY_DIGITS)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#E6EDF7]">
                          {fmt(item.rpsMa50, RPS_METRIC_DISPLAY_DIGITS)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right font-mono',
                            (item.scorePct ?? 0) > 0 ? 'text-[#34D399]' : (item.scorePct ?? 0) < 0 ? 'text-[#F87171]' : 'text-[#A9B6CC]',
                          )}
                        >
                          {fmt(item.scorePct, 2)}
                        </td>
                        <td className="px-3 py-2 text-right text-[#A9B6CC]">
                          {item.trend === 'up' ? '上行' : item.trend === 'down' ? '下行' : '中性'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section
            id="rps-trend-section"
            style={anchorStyle}
            className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg"
          >
            <div className="border-b border-white/10 px-4 py-4">
              <div className="text-lg font-semibold tracking-tight text-white">动量趋势</div>
              <div className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
                保留原有视图切换、时间范围与 Ticker 开关，用于观察不同风格 ETF 相对 {RPS_BENCHMARK_NAME}（{RPS_BENCHMARK_CODE}）的趋势变化。
              </div>
            </div>
            <div className="px-4 py-4">
              <div className="mb-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#94A3B8]">图表视图</span>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setChartView('score')}
                    className={cn(
                      'rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                      chartView === 'score' ? 'border-white/20 bg-white/10 text-[#E6EDF7]' : 'border-white/10 text-[#A9B6CC] hover:border-white/20',
                    )}
                  >
                    MA50归一视图（Score走势）
                  </button>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setChartView('relative')}
                    className={cn(
                      'rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                      chartView === 'relative' ? 'border-white/20 bg-white/10 text-[#E6EDF7]' : 'border-white/10 text-[#A9B6CC] hover:border-white/20',
                    )}
                  >
                    RPS起点归一
                  </button>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setChartView('raw')}
                    className={cn(
                      'rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                      chartView === 'raw' ? 'border-white/20 bg-white/10 text-[#E6EDF7]' : 'border-white/10 text-[#A9B6CC] hover:border-white/20',
                    )}
                  >
                    原始视图
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#94A3B8]">图表指标（Ticker）</span>
                  {Object.keys(enabledTickers)
                    .sort()
                    .map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        disabled={controlsDisabled}
                        onClick={() => {
                          setEnabledTickers((prev) => ({ ...prev, [ticker]: !(prev[ticker] ?? true) }))
                        }}
                        className={cn(
                          'rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                          enabledTickers[ticker]
                            ? 'border-white/20 bg-white/10 text-[#E6EDF7]'
                            : 'border-white/10 bg-transparent text-[#64748B] hover:border-white/15',
                        )}
                        title={ETF_NAME_MAP[ticker] || ticker}
                      >
                        <span className="font-mono">{ticker}</span>
                        <span className="ml-1 text-[#94A3B8]">{ETF_NAME_MAP[ticker] || ''}</span>
                      </button>
                    ))}
                </div>
                {chartView === 'relative' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[#94A3B8]">时间范围</span>
                      {RANGE_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          disabled={controlsDisabled}
                          onClick={() => setRangeKey(option.key)}
                          className={cn(
                            'rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                            rangeKey === option.key ? 'border-white/20 bg-white/10 text-[#E6EDF7]' : 'border-white/10 text-[#A9B6CC] hover:border-white/20',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                      {rangeKey === 'custom' ? (
                        <>
                          <input
                            type="date"
                            disabled={controlsDisabled}
                            value={customStartDateDraft}
                            max={resolvedRange.endDate}
                            onChange={(e) => {
                              setCustomStartDateDraft(e.target.value)
                            }}
                            className="rounded-md border border-white/15 bg-[#0B1220] px-2 py-1 text-[#E6EDF7] outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <button
                            type="button"
                            disabled={controlsDisabled}
                            onClick={() => {
                              setCustomStartDateApplied(clampStartDate(customStartDateDraft, ymd(new Date())))
                            }}
                            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[#E6EDF7] transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            提交
                          </button>
                        </>
                      ) : null}
                    </div>
                    <div className="text-[#64748B]">
                      当前范围：{resolvedRange.startDate} ~ {resolvedRange.endDate}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="relative">
                {loading ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg border border-white/10 bg-black/45 backdrop-blur-sm">
                    <div className="flex items-center gap-2 rounded-md border border-white/15 bg-[#0B1220]/90 px-3 py-2 text-xs text-[#E6EDF7]">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>正在加载图表数据...</span>
                    </div>
                  </div>
                ) : null}
                <RpsStyleChart
                  seriesByTicker={seriesByTicker}
                  viewMode={chartView}
                  baseLabel={`${RPS_BENCHMARK_NAME}（${RPS_BENCHMARK_CODE}）=1`}
                  tickerNameMap={ETF_NAME_MAP}
                  enabledTickers={enabledTickers}
                  lockEdges
                />
              </div>
            </div>
          </section>

          <section
            id="rps-turnover-section"
            style={anchorStyle}
            className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg"
          >
            <div className="border-b border-white/10 px-4 py-4">
              <div className="text-lg font-semibold tracking-tight text-white">成交金额追踪</div>
              <div className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
                最近 90 个交易日展示日成交额与相对过去 20 个真实交易日均值的倍数，`&gt;= 1.50x` 高亮。
              </div>
            </div>
            <div className="px-4 py-4">{turnoverSection}</div>
          </section>
        </>
      ) : (
        customQuerySection
      )}
    </div>
  )
}
