import { useEffect, useMemo, useState } from 'react'
import DataStatusBanner from '@/components/DataStatusBanner'
import FloatingSectionNav, { type FloatingNavSection } from '@/components/FloatingSectionNav'
import RpsStyleChart from '@/components/charts/RpsStyleChart'
import { cn } from '@/lib/utils'
import {
  fetchRpsStyleMatrix,
  fetchRpsStylePanel,
  fetchRpsStyleSeries,
  fetchRpsStyleSummary,
  fetchRpsTurnoverHistory,
  type RpsStyleMatrixItem,
  type RpsStyleSeriesPoint,
  type RpsTurnoverHistoryData,
} from '@/utils/marketApi'
import type { Top100Meta } from '@/utils/etfApi'
import { formatCompactNumber, formatYmd } from '@/utils/format'

const DEFAULT_TICKERS = ['159915.SZ', '588000.SH', '513180.SH', '510300.SH', '512050.SH', '560010.SH']
const TURNOVER_TICKERS = ['512890.SH', ...DEFAULT_TICKERS]
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

const RPS_NAV_SECTIONS: FloatingNavSection[] = [
  { id: 'rps-score-section', label: 'Score截面', shortLabel: 'Score截面' },
  { id: 'rps-trend-section', label: '动量', shortLabel: '动量' },
  { id: 'rps-turnover-section', label: '成交额', shortLabel: '成交额' },
] as const

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

export default function RpsStylePanel() {
  const [loading, setLoading] = useState(true)
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
  const [turnoverMeta, setTurnoverMeta] = useState<Top100Meta | null>(null)
  const [turnoverData, setTurnoverData] = useState<RpsTurnoverHistoryData | null>(null)
  const resolvedRange = useMemo(
    () => resolveDateRange(rangeKey, customStartDateApplied || ymd(addYears(new Date(), -1))),
    [rangeKey, customStartDateApplied],
  )
  const controlsDisabled = loading

  useEffect(() => {
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
            for (const t of tickers) next[t] = prev[t] ?? true
            return next
          })
          const byTicker: Record<string, RpsStyleSeriesPoint[]> = {}
          for (const ticker of tickers) {
            const s = panelRes.data.seriesByTicker?.[ticker]
            byTicker[ticker] = Array.isArray(s) ? s : []
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
          for (const t of tickers) next[t] = prev[t] ?? true
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
          const r = all[i]
          if (r.success === true && Array.isArray(r.data?.series)) byTicker[tickers[i]] = r.data.series
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
  }, [chartView, customStartDateApplied, rangeKey, resolvedRange.endDate, resolvedRange.startDate])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      setTurnoverLoading(true)
      setTurnoverError(null)
      try {
        const res = await fetchRpsTurnoverHistory({ ticker: turnoverTicker, signal: ac.signal })
        if (res.success !== true) {
          setTurnoverError(res.message || '获取成交额历史失败')
          setTurnoverData(null)
          setTurnoverMeta(null)
          setTurnoverLoading(false)
          return
        }
        setTurnoverMeta(res.meta || null)
        setTurnoverData(res.data)
        setTurnoverLoading(false)
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
        setTurnoverError('网络异常或 API 不可用')
        setTurnoverData(null)
        setTurnoverMeta(null)
        setTurnoverLoading(false)
      }
    })()
    return () => ac.abort()
  }, [turnoverTicker])

  const modeCls = useMemo(() => {
    return mode === 'risk_on'
      ? 'border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.10)] text-[#34D399]'
      : 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.10)] text-[#F87171]'
  }, [mode])
  const turnoverRows = useMemo(() => {
    if (!Array.isArray(turnoverData?.series)) return []
    return [...turnoverData.series].reverse()
  }, [turnoverData])
  const selectedTurnoverName = turnoverData?.name || ETF_NAME_MAP[turnoverTicker] || turnoverTicker
  const anchorStyle = useMemo(() => ({ scrollMarginTop: '104px' }), [])
  const turnoverSection = (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#94A3B8]">目标ETF</span>
            {TURNOVER_TICKERS.map((ticker) => (
              <button
                key={ticker}
                type="button"
                disabled={turnoverLoading}
                onClick={() => setTurnoverTicker(ticker)}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50',
                  turnoverTicker === ticker
                    ? 'border-white/20 bg-white/10 text-[#E6EDF7]'
                    : 'border-white/10 text-[#A9B6CC] hover:border-white/20',
                )}
                title={ETF_NAME_MAP[ticker] || ticker}
              >
                <span className="font-mono">{ticker}</span>
                <span className="ml-1 text-[#94A3B8]">{ETF_NAME_MAP[ticker] || ''}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-[320px] rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[#94A3B8]">当前标的</div>
            <div className="text-right text-[#E6EDF7]">
              <div className="font-mono">{turnoverTicker}</div>
              <div className="text-[#94A3B8]">{selectedTurnoverName}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[#94A3B8]">对应基准指数</div>
            <div className="text-right text-[#E6EDF7]">
              <div className="font-mono">{turnoverData?.benchmarkIndex.code || '—'}</div>
              <div className="text-[#94A3B8]">{turnoverData?.benchmarkIndex.name || '—'}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[#94A3B8]">RPS 分母ETF</div>
            <div className="text-right text-[#E6EDF7]">
              <div className="font-mono">{turnoverData?.benchmarkTicker || '—'}</div>
              <div className="text-[#94A3B8]">{turnoverData?.benchmarkName || '—'}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[#94A3B8]">
            <span>数据交易日</span>
            <span className="font-mono text-[#E6EDF7]">{formatYmd(turnoverMeta?.dataDate)}</span>
          </div>
        </div>
      </div>

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
    </div>
  )

  return (
    <div className="relative mt-4 space-y-4">
      <FloatingSectionNav sections={RPS_NAV_SECTIONS} offsetTop={108} />

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xl font-semibold tracking-tight text-white">市场风格 RPS</div>
            <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
              <p><span className="font-medium text-[#CBD5E1]">基准分母</span>：512890.SH（{ETF_NAME_MAP['512890.SH']}）。</p>
              <p><span className="font-medium text-[#CBD5E1]">RPS</span>：目标ETF前复权收盘价 / 红利ETF前复权收盘价。</p>
              <p><span className="font-medium text-[#CBD5E1]">MA50</span>：RPS 的 50 日简单移动平均线。</p>
              <p><span className="font-medium text-[#CBD5E1]">Score</span>：((RPS / MA50) - 1) × 100%。</p>
              <p><span className="font-medium text-[#CBD5E1]">Score说明</span>：Score数值较高，说明该标的在近期（以MA 50天为观察）动量水平较高，可能存在阶段性追涨机会，但需警惕回调）。Score数值较低，说明动量不足，但也有可能存在抄底机会。</p>
              <p><span className="font-medium text-[#CBD5E1]">RPS起点归一</span>：按所选起点将各标的 RPS 与 MA50 同步归一化到 1，便于横向比较（分母基准 512890.SH）。</p>
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
                {items.map((x) => (
                  <tr key={x.ticker} className="border-t border-white/5">
                    <td className="px-3 py-2 text-[#E6EDF7]">
                      <div className="font-mono">{x.ticker}</div>
                      <div className="text-xs text-[#94A3B8]">{ETF_NAME_MAP[x.ticker] || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#E6EDF7]">{fmt(x.rpsRaw, 4)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#E6EDF7]">{fmt(x.rpsMa50, 4)}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono',
                        (x.scorePct ?? 0) > 0 ? 'text-[#34D399]' : (x.scorePct ?? 0) < 0 ? 'text-[#F87171]' : 'text-[#A9B6CC]',
                      )}
                    >
                      {fmt(x.scorePct, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-[#A9B6CC]">
                      {x.trend === 'up' ? '上行' : x.trend === 'down' ? '下行' : '中性'}
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
            保留原有视图切换、时间范围与 Ticker 开关，用于观察不同风格 ETF 相对红利低波基准的趋势变化。
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
                  {RANGE_OPTIONS.map((x) => (
                    <button
                      key={x.key}
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => setRangeKey(x.key)}
                      className={cn(
                        'rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                        rangeKey === x.key ? 'border-white/20 bg-white/10 text-[#E6EDF7]' : 'border-white/10 text-[#A9B6CC] hover:border-white/20',
                      )}
                    >
                      {x.label}
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
              baseLabel={`512890.SH(${ETF_NAME_MAP['512890.SH']})=1`}
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
    </div>
  )
}
