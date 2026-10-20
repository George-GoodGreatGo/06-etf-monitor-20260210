import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import RpsStyleChart from './charts/RpsStyleChart'
import { apiUrl } from '@/utils/apiBase'
import { cn } from '@/lib/utils'
import { createAsyncSnapshotCache } from '@/utils/asyncSnapshotCache'
import { CN_STYLE_BENCHMARK, CN_STYLE_TARGETS, CN_STYLE_CHART_TARGETS, CN_STYLE_DATA_TARGETS, CN_STYLE_NAME_MAP, cnDefaultChartSelection, cnPercentileZone, selectCnChartSeries, type CnStylePanelData } from '@/utils/cnMarketStyle'

const NAMES = CN_STYLE_NAME_MAP
const COLORS = Object.fromEntries(CN_STYLE_DATA_TARGETS.map((x) => [x.ticker, x.color]))
const RANGES = [{ value: 63, label: '3个月' }, { value: 126, label: '6个月' },
  { value: 252, label: '1年' }, { value: 504, label: '2年' }, { value: 0, label: '全部' }]
const ZONES = { cold: 10, hot: 90 }
const SECTIONS = [{ id: 'cn-momentum', label: '动量截面' }, { id: 'cn-history', label: '历史动量' },
  { id: 'rps-turnover-section', label: '成交额' }, { id: 'cn-method', label: '计算口径' }]
const fmt = (v: number | null | undefined, suffix = '%') =>
  v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}${suffix}`
const btn = (active: boolean) => cn(
  'rounded-md border px-3 py-2 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300',
  active ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5',
)

type ResponseData = {
  data: CnStylePanelData
  meta: { fetchedAt: string; dataDate: string; stale: boolean; isFallback: boolean; notes: string[] }
}

const responseCache = createAsyncSnapshotCache<ResponseData>({
  ttlMs: 30_000,
  cacheable: (value) => !value.meta.stale && !value.meta.isFallback && !value.meta.notes.length,
  load: async () => {
    const response = await fetch(apiUrl('/api/rps/cn-panel'), { credentials: 'include', cache: 'no-store' })
    const json = await response.json()
    if (!response.ok || !json.success) throw new Error(json.message || '数据读取失败')
    if (json.data?.benchmarkTicker !== CN_STYLE_BENCHMARK
      || !Array.isArray(json.data.items) || !json.data.seriesByTicker
      || Object.values(json.data.seriesByTicker).some((points) => !Array.isArray(points)
        || points.some((p) => p.benchmarkTicker !== CN_STYLE_BENCHMARK))) throw new Error('沪深300基准数据不完整，拒绝显示旧口径。')
    return json
  },
})

export default function CnMarketStylePanel({ children, previewData }: { children?: ReactNode; previewData?: ResponseData }) {
  const fixture = import.meta.env.DEV ? previewData : undefined
  const [snapshot, setSnapshot] = useState<ResponseData | null>(fixture || null)
  const [loading, setLoading] = useState(!fixture)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [view, setView] = useState<'percentile' | 'score' | 'relative'>('percentile')
  const [range, setRange] = useState(252)
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    cnDefaultChartSelection,
  )
  useEffect(() => {
    if (fixture) return
    let cancelled = false
    setLoading(true)
    setError('')
    responseCache.get(reload > 0)
      .then((json) => {
        if (!cancelled) setSnapshot(json)
      }).catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '网络异常')
      }).finally(() => { if (!cancelled) setLoading(false) })
    // Do not abort a shared request when one subscriber unmounts.
    return () => { cancelled = true }
  }, [reload, fixture])
  const full = snapshot?.data.seriesByTicker
  const chartSeries = useMemo(() => {
    const chartFull = selectCnChartSeries(full || {})
    const dates = [...new Set(Object.values(chartFull).flatMap((s) => s.map((p) => p.date)))].sort()
    const start = range ? dates[Math.max(0, dates.length - range)] : ''
    return Object.fromEntries(Object.entries(chartFull).map(([ticker, points]) =>
      [ticker, points.filter((p) => !start || p.date >= start)]))
  }, [full, range])
  const selected = Object.keys(chartSeries).filter((t) => enabled[t] !== false && chartSeries[t].length)
  const single = selected.length === 1 ? selected[0] : null
  const latest = single ? full?.[single].find((p) => p.date === snapshot?.data.dataDate) : null
  const scoreZones = latest?.historicalCold != null && latest?.historicalHot != null
    && latest.historicalCold < latest.historicalHot ? { cold: latest.historicalCold, hot: latest.historicalHot } : null
  const items = (snapshot?.data.items || []).filter((item) => CN_STYLE_TARGETS.some((x) => x.ticker === item.ticker))
  const missing = items.filter((x) => x.scorePct == null || x.scoreChange5dPp == null)
  const chartUnavailable = CN_STYLE_CHART_TARGETS.filter(({ ticker }) => !full?.[ticker]?.length)
  const immature = CN_STYLE_CHART_TARGETS.filter(({ ticker }) =>
    full?.[ticker]?.find((p) => p.date === snapshot?.data.dataDate)?.percentile == null)
  const leaders = items.filter((x) => x.scorePct != null)
  const trendNames = (trend: string) => items.filter((x) => x.trend === trend).map((x) => NAMES[x.ticker]).join('、') || '暂无'

  return <div className="relative min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">市场风格 RPS 总览</h1>
        <p className="mt-1 text-sm text-slate-400">基准沪深300（000300） · {CN_STYLE_TARGETS.length}只 ETF · 人民币前复权价格 / 指数点位</p>
        {snapshot && <p className="mt-2 text-xs text-slate-400">统一截止交易日：{snapshot.data.dataDate}（上海） · 最早源快照：{new Date(snapshot.meta.fetchedAt).toLocaleString('zh-CN')} · 人民币前复权价格 / 指数点位</p>}
      </div>
      <button type="button" disabled={loading} onClick={() => setReload((n) => n + 1)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A66] px-4 py-2.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#FFA084] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 disabled:opacity-50 motion-reduce:transition-none">
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin motion-reduce:animate-none')} />刷新读取
      </button>
    </header>
    <nav aria-label="页面模块导航" className="flex flex-wrap gap-x-4 gap-y-2 border-b border-white/[0.06] pb-3 text-xs text-slate-400">
      {SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`} className="rounded-sm py-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">{section.label}</a>)}
    </nav>
    {loading && <p role="status" className="rounded-lg border border-white/10 p-4 text-sm text-slate-400">正在读取并重算沪深300动量数据...</p>}
    {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}{snapshot ? ' 当前保留上次成功读取的数据。' : ''}</p>}
    {snapshot && <>
      {(snapshot.meta.stale || snapshot.meta.isFallback) && <p role="alert" className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
        {snapshot.meta.stale ? '指数数据超过14个自然日未更新。' : ''}{snapshot.meta.isFallback ? '部分数据使用备用快照。' : ''} 请核对交易日，以下不是实时行情。
      </p>}
      {missing.length > 0 && <p role="alert" className="text-xs leading-6 text-amber-200">以下标的在统一截止日缺行情或未满足均线 / 5日变化预热：{missing.map((x) => NAMES[x.ticker]).join('、')}。不以旧日 Score 替代，不提供动量判定。</p>}
      {snapshot.meta.notes.length > 0 && <details className="text-xs text-slate-400"><summary className="cursor-pointer">行情读取提示</summary>{snapshot.meta.notes.map((n) => <p key={n} className="mt-2">{n}</p>)}</details>}
      <section className="min-w-0 rounded-lg bg-[#101B24]/80 px-4 py-3 sm:px-5" aria-labelledby="cn-overview-title">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cn-overview-title" className="text-xs font-medium text-slate-300">动量概览</h2>
          <span className="text-xs text-slate-400">当前快照 · 相对沪深300</span>
        </div>
        <dl className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]" aria-label="动量摘要">
          <div className="min-w-0 border-b border-white/[0.06] pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-5">
            <dt className="text-xs text-slate-400">Score 最高</dt>
            <dd className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {leaders.length ? <><strong className="text-lg font-semibold text-white">{leaders[0].ticker.split('.')[0]}</strong>
                <span className="font-mono text-3xl font-semibold text-white tabular-nums">{fmt(leaders[0].scorePct)}</span>
                <span className="text-xs text-slate-400">{NAMES[leaders[0].ticker]}</span></> : <span className="text-sm text-slate-400">暂无有效 Score</span>}
            </dd>
          </div>
          {[{ title: '动量走强 · 5日', trend: 'up', Icon: ArrowUpRight, color: 'text-red-300' },
            { title: '动量走弱 · 5日', trend: 'down', Icon: ArrowDownRight, color: 'text-emerald-300' }].map(({ title, trend, Icon, color }) =>
            <div key={title} className="min-w-0 md:pl-2">
              <dt className="flex items-center gap-1.5 text-xs text-slate-400"><Icon className={cn('h-4 w-4', color)} aria-hidden="true" />{title}</dt>
              <dd className="mt-2 text-sm leading-6 text-slate-200">{trendNames(trend)}</dd>
            </div>)}
        </dl>
      </section>
      <section id="cn-momentum" aria-labelledby="cn-momentum-title" className="min-w-0 scroll-mt-28 rounded-lg border border-white/[0.06] bg-[#0C141B]/70 px-4 py-3 sm:px-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2"><h2 id="cn-momentum-title" className="text-sm font-semibold text-slate-200">动量截面</h2>
          <p className="text-xs text-slate-400">Score 降序 · 百分位与自身历史比较</p></div>
        <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" role="region" aria-label="动量截面全部指标" tabIndex={0}><table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="text-xs text-slate-400"><tr>{['标的 / 风格', 'Score', '5日变化（pp）', '20日相对收益', '历史百分位', '冷热区域', '动量状态'].map((x, i) => <th key={x} className={cn('border-b border-white/10 px-3 py-2.5 font-medium', i >= 1 && i <= 4 && 'text-right')}>{x}</th>)}</tr></thead>
          <tbody>{items.map((item) => {
            const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus
            const zone = cnPercentileZone(item.scorePct == null ? null : item.percentile)
            return <tr key={item.ticker} className="border-t border-white/5 hover:bg-white/[0.025]">
              <td className="px-3 py-2.5"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[item.ticker] }} /><strong className="font-medium">{item.ticker.split('.')[0]}</strong><span className="ml-2 text-xs text-slate-400">{NAMES[item.ticker]}</span></td>
              <td className={cn('px-3 py-2.5 text-right font-mono font-semibold tabular-nums', (item.scorePct ?? 0) > 0 ? 'text-red-300' : (item.scorePct ?? 0) < 0 ? 'text-emerald-300' : 'text-slate-400')}>{fmt(item.scorePct)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmt(item.scoreChange5dPp, ' pp')}</td>
              <td className="px-3 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(item.relativeReturn20dPct)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums" title={`此前有效 Score：${item.historyCount} 个`}>{item.scorePct == null ? '行情缺失 / 预热' : item.percentile == null ? `样本不足（${item.historyCount}/252）` : `${item.percentile.toFixed(1)}`}</td>
              <td className="px-3 py-2.5"><span className={cn('text-xs',
                zone === '过热区' ? 'text-red-300' : zone === '过冷区' ? 'text-sky-300' : 'text-slate-400')}>{zone}</span></td>
              <td className="px-3 py-2.5"><span className={cn('inline-flex items-center gap-1.5 text-xs',
                item.trend === 'up' ? 'text-red-300' : item.trend === 'down' ? 'text-emerald-300' : 'text-slate-400')}><Icon className="h-3.5 w-3.5" />{item.quadrant}</span></td>
            </tr>
          })}</tbody></table></div>
        <p className="mt-2 text-[11px] leading-5 text-slate-400">5日变化单位为百分点；20日相对收益以沪深300为基准。百分位≤10过冷、≥90过热，其余为其它；无有效样本不判定。</p>
        <p className="mt-1 text-[11px] text-slate-400 lg:hidden">左右滑动表格查看全部指标</p>
      </section>
      <section id="cn-history" aria-labelledby="cn-history-title" className="min-w-0 scroll-mt-28 space-y-3 rounded-lg border border-white/[0.06] bg-[#0C141B]/70 px-4 py-3 sm:px-5">
        {chartUnavailable.length > 0 && <p role="alert" className="mt-2 text-xs leading-6 text-amber-200">
          暂无历史行情，选项暂不可用：{chartUnavailable.map((x) => x.name).join('、')}。请确认后端已部署最新代码，并运行 GitHub Action「Refresh RPS Style Snapshots」后刷新读取；这不是百分位样本不足。
        </p>}
        <div className="space-y-2 border-b border-white/[0.06] pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="cn-history-title" className="text-sm font-semibold text-slate-200">动量趋势</h2>
          <div className="flex flex-wrap rounded-lg bg-white/5 p-1" role="group" aria-label="趋势视图">{[{ value: 'percentile' as const, label: '历史百分位' }, { value: 'score' as const, label: 'Score 走势' }, { value: 'relative' as const, label: 'RPS 起点归一' }].map((x) =>
            <button key={x.value} type="button" aria-pressed={view === x.value} onClick={() => setView(x.value)} className={cn('rounded-md px-3 py-2 text-xs font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300', view === x.value ? 'bg-slate-600/50 text-white' : 'text-slate-400 hover:text-white')}>{x.label}</button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="时间范围">{RANGES.map((x) =>
            <button key={x.value} type="button" aria-pressed={range === x.value} onClick={() => setRange(x.value)} className={cn('rounded px-2.5 py-2 text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400', range === x.value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>{x.label}</button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="比较标的"><span className="text-xs text-slate-400">比较标的</span>{CN_STYLE_CHART_TARGETS.map((x) => <button key={x.ticker} type="button" aria-pressed={enabled[x.ticker]}
            title={!full?.[x.ticker]?.length ? '缺少历史行情，请更新后端并运行 Refresh RPS Style Snapshots' : x.name}
            disabled={!full?.[x.ticker]?.length} onClick={() => setEnabled((p) => ({ ...p, [x.ticker]: !p[x.ticker] }))} className={cn(btn(enabled[x.ticker]), 'disabled:cursor-not-allowed disabled:opacity-40')}>
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: x.color }} />{x.ticker.split('.')[0]} {x.name}
          </button>)}</div>
        </div>
        {view === 'percentile' && <div className="text-xs leading-6 text-slate-400">
          <p>与自身此前五年比较，排除当天及未来，至少252样本；≤10过冷、≥90过热，中位参考线50。不是标的间排名。</p>
          {immature.length > 0 && <p role="status" className="text-amber-200">当前没有有效百分位：{immature.map((x) => NAMES[x.ticker]).join('、')}。预热或缺行情的日期不填值。</p>}
        </div>}
        {view === 'score' && <p className="mb-3 text-xs leading-6 text-slate-400">{scoreZones
          ? `${single} 自身历史 P10：${scoreZones.cold.toFixed(2)}%，P90：${scoreZones.hot.toFixed(2)}%。底色采用最新时点的此前五年可用历史阈值，仅作当前参考，不用于回测。`
          : 'Score 为 RPS 相对 MA50 的偏离（%），0为均线基线；多标的不共用冷热阈值。单选且满足252个历史有效 Score 时显示自身 P10/P90。'}</p>}
        {!selected.length && <p role="status" className="mb-3 text-xs text-slate-400">请选择至少一个标的。</p>}
        {view === 'relative' && <p className="mb-3 text-xs leading-6 text-slate-400">各标的以显示区间内首个可用交易日归一为1。新上市或缺行情的标的起点可能较晚，请先核对起点日期；不同起点不适合直接比较区间收益。</p>}
        <RpsStyleChart seriesByTicker={chartSeries} viewMode={view} enabledTickers={enabled} tickerNameMap={NAMES} tickerColorMap={COLORS}
          baseLabel="各标的相对沪深300指数的 RPS 在区间起点归一为1" lockEdges={false} scoreBands={false}
          compactLegend preserveChartHeight scoreZones={view === 'percentile' ? ZONES : scoreZones} />
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] leading-5 text-slate-400">
          <p>百分位高不代表 Score 为正或价格上涨；冷热区不是反转或买卖信号。</p>
          <span>滚轮缩放 · 拖动 · 悬停查看</span>
        </div>
      </section>
    </>}
    {children}
    <details id="cn-method" className="scroll-mt-28 border-t border-white/[0.06] pt-3 text-sm leading-7 text-slate-400">
      <summary className="cursor-pointer rounded-sm text-xs font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"><h2 className="inline text-xs">A股计算口径与阅读方法</h2></summary>
      <div className="mt-3 space-y-2">
      <p>RPS = ETF 人民币前复权收盘价 / 沪深300指数收盘点位；MA50 = RPS 的50个连续有效内地交易日简单均线；Score = (RPS / MA50 − 1) × 100%。沪深300指数自身 Score 恒为0，不参与排名。冷热区域采用自身历史百分位，不是价格涨跌或交易建议。</p>
      <p>5日变化 = 今日 Score − 5个内地交易日前 Score；超过 +0.20 pp 为走强，低于 −0.20 pp 为走弱，其余平稳。该阈值仅过滤微小展示波动，未经回测验证。20日相对收益 = (今日 RPS / 20个内地交易日前 RPS − 1) × 100%，不是绝对收益或简单收益之差。</p>
      <p>按上海时区15:30后视为当日完整行情；使用指数实际交易日期，不填周末、春节及国庆休市日，不向前填补缺失ETF价格。缺失交易日后 MA50 重新预热50日，各标的独立计算。源行情失败或尚未更新时明确显示缺失，不推测价格。</p>
      <p>前复权处理 ETF 分红和份额调整，避免除权跳变；沪深300（000300）是价格指数，不是全收益指数，因此此处相对收益含 ETF 分红调整与指数不计分红的口径差异，不等同严格的总回报超额收益。</p>
      <p>513180 为内地上市恒生科技 ETF，人民币场内价格含汇率、折溢价及港股休市影响，不代表纯A股风格或港股净值收益。A股涨跌停、停牌及流动性约束可能延续极端动量；冷热区不意味着可立即成交或必然反转。</p>
      <p>历史百分位采用自身此前五个日历年的有效 Score，排除当天与未来，至少252个样本，同值取中间排名。先用完整历史计算，再裁剪显示范围；新上市ETF不拼接指数历史，不缩短其他标的窗口。无有效百分位不判定冷热。单标的Score底色用最新时点的自身P10/P90，仅作当前参考，不用于回测。</p>
      <p>不生成主攻仓位或进攻 / 防守交易建议。已有自定义动量分析及策略信号仍沿用原红利低波基准，本次仅改版总览。不构成投资建议。</p>
      </div>
    </details>
  </div>
}
