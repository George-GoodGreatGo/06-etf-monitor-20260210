import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Activity,
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  Clock,
  Construction,
  Info,
  Loader2,
  Sparkles,
  BrainCircuit,
  CheckCircle2,
  ListTodo,
  Target,
  TrendingUp,
} from 'lucide-react'
import NavBar from '@/components/NavBar'
import DataStatusBanner from '@/components/DataStatusBanner'
import EtfWeeklyChart from '@/components/charts/EtfWeeklyChart'
import ZBadge from '@/components/ZBadge'
import {
  type EtfDetail,
  type EtfWeeklyChart as EtfWeeklyChartData,
  fetchEtfDetail,
  fetchEtfWeeklyChart,
  type Top100Meta,
} from '@/utils/etfApi'
import { formatYmd } from '@/utils/format'
import { adminAuthHeaders } from '@/utils/adminAccess'
import { apiUrl } from '@/utils/apiBase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function tryParseFirstJsonObject(text: string): Record<string, unknown> | null {
  const raw = String(text || '')
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  const candidate = raw.slice(start, end + 1).trim()
  if (!candidate.startsWith('{') || !candidate.endsWith('}')) return null
  try {
    const j = JSON.parse(candidate) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    return j as Record<string, unknown>
  } catch {
    return null
  }
}

function splitNonEmptyLines(text: string): string[] {
  return String(text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapInsightStatusCn(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return '—'
  const up = s.toUpperCase()
  const map: Record<string, string> = {
    WATCH: '观察',
    WAIT: '等待',
    BUY: '买入',
    SELL: '卖出',
    HOLD: '持有',
    AVOID: '回避',
    RISK: '高风险',
  }
  return map[up] || s
}

function formatConfidenceScore(raw: unknown): string {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return '—'
  const n = Math.round(raw)
  return `${Math.min(100, Math.max(0, n))}/100`
}

export default function EtfDetail() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const backUrl = `/?${searchParams.toString()}`

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [data, setData] = useState<EtfDetail | null>(null)

  const [weeklyLoading, setWeeklyLoading] = useState(true)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [weeklyMeta, setWeeklyMeta] = useState<Top100Meta | null>(null)
  const [weeklyData, setWeeklyData] = useState<EtfWeeklyChartData | null>(null)

  const [insightStatus, setInsightStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [insightError, setInsightError] = useState<string | null>(null)
  const [insightText, setInsightText] = useState('')
  const insightAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => insightAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!code) return
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchEtfDetail(code, ac.signal)
        if (res.success === false) {
          setMeta(null)
          setData(null)
          setError(res.message ?? res.error)
          setLoading(false)
          return
        }
        setMeta(res.meta)
        setData(res.data)
        setLoading(false)
      } catch (e) {
        const name =
          typeof e === 'object' && e && 'name' in e
            ? String((e as { name: unknown }).name)
            : ''
        if (name === 'AbortError') return
        setMeta(null)
        setData(null)
        setError('网络异常或 API 不可用')
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [code])

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }: { children?: ReactNode }) => (
        <h1 className="mb-2 mt-2 text-base font-semibold text-[#F8FAFC]">{children}</h1>
      ),
      h2: ({ children }: { children?: ReactNode }) => (
        <h2 className="mb-2 mt-2 text-sm font-semibold text-[#F1F5F9]">{children}</h2>
      ),
      h3: ({ children }: { children?: ReactNode }) => (
        <h3 className="mb-1 mt-2 text-sm font-semibold text-[#E2E8F0]">{children}</h3>
      ),
      p: ({ children }: { children?: ReactNode }) => <p className="mb-2 leading-7 text-[#E6EDF7]">{children}</p>,
      ul: ({ children }: { children?: ReactNode }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
      ol: ({ children }: { children?: ReactNode }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
      li: ({ children }: { children?: ReactNode }) => <li className="leading-7 text-[#E6EDF7]">{children}</li>,
      strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-[#FFF2E8]">{children}</strong>,
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote className="my-2 border-l-2 border-white/20 pl-3 text-[#CBD5E1]">{children}</blockquote>
      ),
      table: ({ children }: { children?: ReactNode }) => <table className="my-2 w-full border-collapse text-xs">{children}</table>,
      th: ({ children }: { children?: ReactNode }) => (
        <th className="border border-white/10 px-2 py-1 text-left font-semibold text-[#E2E8F0]">{children}</th>
      ),
      td: ({ children }: { children?: ReactNode }) => <td className="border border-white/10 px-2 py-1 text-[#E6EDF7]">{children}</td>,
      code: ({ children }: { children?: ReactNode }) => (
        <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] text-[#FDE68A]">{children}</code>
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-[#FFB08A] underline decoration-dotted underline-offset-2">
          {children}
        </a>
      ),
    }),
    [],
  )

  const insightJson = useMemo(() => tryParseFirstJsonObject(insightText), [insightText])

  const startInsight = useMemo(() => {
    return async () => {
      if (!code) return
      if (!weeklyData) {
        setInsightStatus('error')
        setInsightError('周线数据未就绪，无法解读')
        return
      }

      insightAbortRef.current?.abort()
      const ac = new AbortController()
      insightAbortRef.current = ac

      setInsightStatus('running')
      setInsightError(null)
      setInsightText('')

      try {
        const res = await fetch(apiUrl('/api/ai/etf/detail/insight'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...adminAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as unknown
          const msg =
            j && typeof j === 'object' && (j as Record<string, unknown>).message
              ? String((j as Record<string, unknown>).message)
              : `HTTP ${res.status}`
          setInsightStatus('error')
          setInsightError(msg)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        let finished = false
        let hadError = false

        const handleEvent = (o: Record<string, unknown>) => {
          const type = typeof o.type === 'string' ? o.type : ''
          if (type === 'content' && typeof o.content === 'string') {
            setInsightText((prev) => prev + o.content)
            return { done: false }
          }
          if (type === 'answer') {
            const c = o.content as unknown
            const answer =
              c && typeof c === 'object' && typeof (c as Record<string, unknown>).answer === 'string'
                ? String((c as Record<string, unknown>).answer)
                : ''
            if (answer) setInsightText((prev) => prev + answer)
            if (Boolean(o.finish)) return { done: true }
            return { done: false }
          }
          if (type === 'end') {
            const status = typeof o.status === 'string' ? o.status : ''
            if (status === 'error') {
              const msg = typeof o.message === 'string' ? o.message : '解读失败'
              setInsightStatus('error')
              setInsightError(msg)
              hadError = true
            }
            return { done: true }
          }
          return { done: false }
        }

        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          if (!chunk) continue
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trimStart()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (!data || data === '[DONE]') continue
            try {
              const j = JSON.parse(data) as unknown
              if (!j || typeof j !== 'object') continue
              const r = handleEvent(j as Record<string, unknown>)
              if (r.done) {
                finished = true
                break
              }
            } catch {
              void 0
            }
          }
        }

        if (!hadError) {
          setInsightStatus('done')
        }
      } catch (e) {
        const name = typeof e === 'object' && e && 'name' in e ? String((e as { name: unknown }).name) : ''
        if (name === 'AbortError') return
        setInsightStatus('error')
        setInsightError(e instanceof Error ? e.message : String(e))
      }
    }
  }, [code, weeklyData])

  useEffect(() => {
    if (!code) return
    const ac = new AbortController()
    ;(async () => {
      setWeeklyLoading(true)
      setWeeklyError(null)
      try {
        const res = await fetchEtfWeeklyChart(code, ac.signal)
        if (res.success === false) {
          setWeeklyMeta(null)
          setWeeklyData(null)
          setWeeklyError(res.message ?? res.error)
          setWeeklyLoading(false)
          return
        }
        setWeeklyMeta(res.meta)
        setWeeklyData(res.data)
        setWeeklyLoading(false)
      } catch (e) {
        const name =
          typeof e === 'object' && e && 'name' in e
            ? String((e as { name: unknown }).name)
            : ''
        if (name === 'AbortError') return
        setWeeklyMeta(null)
        setWeeklyData(null)
        setWeeklyError('网络异常或 API 不可用')
        setWeeklyLoading(false)
      }
    })()
    return () => ac.abort()
  }, [code])

  return (
    <div>
      <NavBar
        rightMeta={
          meta
            ? {
                fetchedAt: meta.cachedAt || meta.fetchedAt,
                dataDate: meta.dataDate,
              }
            : undefined
        }
      />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            返回 Top100
          </Link>
        </div>

        <DataStatusBanner
          loading={loading}
          error={error}
          meta={meta}
          incompleteCount={0}
          onRetry={() => {
            if (!code) return
            const ac = new AbortController()
            setLoading(true)
            setError(null)
            fetchEtfDetail(code, ac.signal)
              .then((res) => {
                if (res.success === false) {
                  setMeta(null)
                  setData(null)
                  setError(res.message ?? res.error)
                  setLoading(false)
                  return
                }
                setMeta(res.meta)
                setData(res.data)
                setLoading(false)
              })
              .catch((e) => {
                const name =
                  typeof e === 'object' && e && 'name' in e
                    ? String((e as { name: unknown }).name)
                    : ''
                if (name === 'AbortError') return
                setMeta(null)
                setData(null)
                setError('网络异常或 API 不可用')
                setLoading(false)
              })
          }}
        />

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#111B2E] p-4 md:col-span-2">
            <div className="text-xs text-[#A9B6CC]">ETF</div>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              <span className="font-mono">{code}</span>{' '}
              <span className="text-[#A9B6CC]">{data?.name ?? '—'}</span>
            </h1>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[#A9B6CC]">最新完整交易日</div>
                <div className="mt-1 font-mono text-sm">
                  {formatYmd(data?.latestTradingDate)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[#A9B6CC]">90 日成交额 Z 值</div>
                <div className="mt-1">
                  <ZBadge
                    z={data?.z90 ?? null}
                    status={error ? 'api_error' : 'complete'}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[#A9B6CC]">说明</div>
                <div className="mt-1 text-xs text-[#A9B6CC]">
                  当前页面为占位，后续逐步补充更多指标
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#111B2E] p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-[#A9B6CC]" />
              <div>
                <div className="text-sm font-medium">数据约束</div>
                <div className="mt-1 text-xs text-[#A9B6CC]">
                  仅展示完整交易日数据；缺失/失败不补全、不杜撰。
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 text-xs text-[#A9B6CC] hover:text-[#E6EDF7]"
              >
                查看数据与方法说明 →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">周线图表</div>
          </div>

          <div className="mt-3">
            <DataStatusBanner
              loading={weeklyLoading}
              error={weeklyError}
              meta={weeklyMeta}
              incompleteCount={0}
              onRetry={() => {
                if (!code) return
                const ac = new AbortController()
                setWeeklyLoading(true)
                setWeeklyError(null)
                fetchEtfWeeklyChart(code, ac.signal)
                  .then((res) => {
                    if (res.success === false) {
                      setWeeklyMeta(null)
                      setWeeklyData(null)
                      setWeeklyError(res.message ?? res.error)
                      setWeeklyLoading(false)
                      return
                    }
                    setWeeklyMeta(res.meta)
                    setWeeklyData(res.data)
                    setWeeklyLoading(false)
                  })
                  .catch((e) => {
                    const name =
                      typeof e === 'object' && e && 'name' in e
                        ? String((e as { name: unknown }).name)
                        : ''
                    if (name === 'AbortError') return
                    setWeeklyMeta(null)
                    setWeeklyData(null)
                    setWeeklyError('网络异常或 API 不可用')
                    setWeeklyLoading(false)
                  })
              }}
            />
          </div>

          {weeklyData ? (
            <div className="mt-4">
              <EtfWeeklyChart series={weeklyData.series} />
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF8A50]" />
              <div className="text-sm font-medium">数据解读</div>
            </div>
            <button
              type="button"
              onClick={startInsight}
              disabled={!code || insightStatus === 'running'}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {insightStatus === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              开始解读
            </button>
          </div>

          {insightStatus === 'running' ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF8A50]" />
              正在调用模型进行解读，请稍后
            </div>
          ) : null}

          {insightStatus === 'error' ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[#EF4444]" />
              <div>
                <div className="text-[#E6EDF7]">解读失败</div>
                <div className="mt-0.5">{insightError || '未知错误'}</div>
              </div>
            </div>
          ) : null}

          {insightText.trim() ? (
            <div className="mt-3 text-sm leading-relaxed text-[#E6EDF7]">
              {insightJson ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
                        <Target className="h-3.5 w-3.5 text-[#FF8A50]" />
                        结论状态
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[#E6EDF7]">{mapInsightStatusCn(insightJson.status)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                        置信度
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[#E6EDF7]">{formatConfidenceScore(insightJson.confidence_score)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
                        <Sparkles className="h-3.5 w-3.5 text-[#FB7185]" />
                        形态/模型
                      </div>
                      <div className="mt-2 text-[13px] font-semibold leading-relaxed text-[#E6EDF7]">
                        {typeof insightJson.setup_type === 'string' ? insightJson.setup_type : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
                        <Clock className="h-3.5 w-3.5 text-[#60A5FA]" />
                        分析时间
                      </div>
                      <div className="mt-2 font-mono text-[13px] font-semibold text-[#E6EDF7]">
                        {typeof insightJson.analysis_time === 'string' ? insightJson.analysis_time : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 md:col-span-2">
                      <div className="flex items-center gap-2 text-xs text-[#A9B6CC]">
                        <CalendarRange className="h-3.5 w-3.5 text-[#A78BFA]" />
                        数据区间
                      </div>
                      <div className="mt-2 font-mono text-[13px] font-semibold text-[#E6EDF7]">
                        {typeof insightJson.data_period === 'string' ? insightJson.data_period : '—'}
                      </div>
                    </div>
                  </div>

                  {typeof insightJson.core_logic === 'string' ? (
                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF7]">
                        <Target className="h-4 w-4 text-[#FF8A50]" />
                        核心逻辑
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[#CBD5E1]">{insightJson.core_logic}</div>
                    </div>
                  ) : null}

                  {insightJson.detailed_analysis && typeof insightJson.detailed_analysis === 'object' ? (
                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF7]">
                        <TrendingUp className="h-4 w-4 text-[#38BDF8]" />
                        详细分析
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {(() => {
                          const o = insightJson.detailed_analysis as Record<string, unknown>
                          const items: Array<{ key: string; title: string; icon: ReactNode; accent: string }> = [
                            {
                              key: 'trend_and_margin',
                              title: '趋势与安全边际',
                              icon: <TrendingUp className="h-3.5 w-3.5 text-[#38BDF8]" />,
                              accent: 'border-[#38BDF8]/30',
                            },
                            {
                              key: 'momentum_and_vol',
                              title: '动量与量能',
                              icon: <Activity className="h-3.5 w-3.5 text-[#34D399]" />,
                              accent: 'border-[#34D399]/30',
                            },
                            {
                              key: 'risk_warning',
                              title: '风险提示',
                              icon: <AlertTriangle className="h-3.5 w-3.5 text-[#F43F5E]" />,
                              accent: 'border-[#F43F5E]/30',
                            },
                          ]
                          return items
                            .map((it) => {
                              const v = o[it.key]
                              if (typeof v !== 'string' || !v.trim()) return null
                              return (
                                <div key={it.key} className={`rounded-xl border bg-white/5 p-3 ${it.accent}`}>
                                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E6EDF7]">
                                    {it.icon}
                                    {it.title}
                                  </div>
                                  <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#CBD5E1]">{v}</div>
                                </div>
                              )
                            })
                            .filter(Boolean)
                        })()}
                      </div>
                    </div>
                  ) : null}

                  {insightJson.action_plan && typeof insightJson.action_plan === 'object' ? (
                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#E6EDF7]">
                        <ListTodo className="h-4 w-4 text-[#22C55E]" />
                        操作计划
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {(() => {
                          const o = insightJson.action_plan as Record<string, unknown>
                          const entry = typeof o.entry_zone === 'string' ? o.entry_zone.trim() : ''
                          const stop = typeof o.stop_loss === 'string' ? o.stop_loss.trim() : ''
                          return (
                            <>
                              <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E6EDF7]">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  入场条件/区间
                                </div>
                                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#CBD5E1]">{entry || '—'}</div>
                              </div>
                              <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E6EDF7]">
                                  <AlertTriangle className="h-3.5 w-3.5 text-[#F43F5E]" />
                                  止损位
                                </div>
                                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#CBD5E1]">{stop || '—'}</div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  ) : null}

                  {typeof insightJson.thinking_process === 'string' && insightJson.thinking_process.trim() ? (
                    <details className="rounded-xl border border-white/10 bg-black/10 px-4 py-4 group">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#E6EDF7] list-none">
                        <BrainCircuit className="h-4 w-4 text-[#A78BFA]" />
                        推导过程
                        <ChevronDown className="ml-auto h-4 w-4 text-[#94A3B8] transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-3 border-t border-white/10 pt-4">
                        {splitNonEmptyLines(insightJson.thinking_process).length > 1 ? (
                          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-[#CBD5E1]">
                            {splitNonEmptyLines(insightJson.thinking_process).map((line, idx) => (
                              <li key={`${idx}-${line}`}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#CBD5E1]">{insightJson.thinking_process}</div>
                        )}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {insightText}
                </ReactMarkdown>
              )}
            </div>
          ) : insightStatus === 'idle' ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
              点击“开始解读”，将基于周线指标生成交易机会解读
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          {['资金流', '更多指标'].map((t) => (
            <div
              key={t}
              className="rounded-xl border border-white/10 bg-[#111B2E] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t}</div>
                <Construction className="h-4 w-4 text-[#A9B6CC]" />
              </div>
              <div className="mt-2 text-xs text-[#A9B6CC]">模块占位，后续上线</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
