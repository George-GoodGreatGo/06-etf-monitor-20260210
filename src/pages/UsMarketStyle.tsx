import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import PageContentContainer from '@/components/PageContentContainer'
import PageBreadcrumb from '@/components/PageBreadcrumb'
import RpsStyleChart from '@/components/charts/RpsStyleChart'
import { apiUrl } from '@/utils/apiBase'
import { cn } from '@/lib/utils'
import { buildUsPercentileSeries, getUsMomentumCrossSection, isCurrentUsStyleSnapshot, US_STYLE_TARGETS, type UsStyleSnapshot } from '@/utils/usMarketStyle'

const NAMES = Object.fromEntries(US_STYLE_TARGETS.map((x) => [x.ticker, x.name]))
const COLORS = Object.fromEntries(US_STYLE_TARGETS.map((x) => [x.ticker, x.color]))
const PERCENTILE_ZONES = { cold: 10, hot: 90 }
const RANGES = [{ value: 63, label: '3个月' }, { value: 126, label: '6个月' },
  { value: 252, label: '1年' }, { value: 504, label: '2年' }, { value: 0, label: '全部' }]
const fmt = (v: number, suffix = '%') => `${v > 0 ? '+' : ''}${v.toFixed(2)}${suffix}`
const buttonClass = (active: boolean) => cn(
  'rounded-md border px-3 py-2 text-xs transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]',
  active ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-[#94A3B8] hover:bg-white/5',
)

export default function UsMarketStyle() {
  const [snapshot, setSnapshot] = useState<UsStyleSnapshot | null>(null)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [refreshTicket, setRefreshTicket] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateError, setUpdateError] = useState(false)
  const [runUrl, setRunUrl] = useState<string | null>(null)
  const submitting = useRef(false)
  const updateAbort = useRef<AbortController | null>(null)
  const [view, setView] = useState<'score' | 'relative' | 'percentile'>('percentile')
  const [range, setRange] = useState(252)
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(US_STYLE_TARGETS.map((x) => [x.ticker, x.ticker === 'VYM' || x.ticker === 'VGT'])),
  )
  useEffect(() => () => updateAbort.current?.abort(), [])
  async function updateMarketData() {
    if (submitting.current || updating) return
    submitting.current = true
    setUpdating(true)
    setUpdateError(false)
    setRunUrl(null)
    setUpdateMessage('正在提交市场数据更新任务...')
    const controller = new AbortController()
    updateAbort.current = controller
    try {
      const response = await fetch(apiUrl('/api/us-market-style/refresh'), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: '{}', signal: controller.signal,
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || '提交更新失败')
      setRefreshTicket(json.data.ticket)
      setUpdateMessage('任务已提交，等待 GitHub Actions 启动...')
    } catch (e) {
      if (!controller.signal.aborted) {
        setUpdateError(true)
        setUpdateMessage(e instanceof Error ? e.message : '提交更新失败')
        setUpdating(false)
      }
    } finally { submitting.current = false }
  }
  useEffect(() => {
    if (!refreshTicket) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const deadline = Date.now() + 20 * 60_000
    let failures = 0
    async function poll() {
      try {
        if (Date.now() > deadline) throw new Error('等待更新超时，任务可能仍在执行。请查看 GitHub 任务或稍后刷新读取。')
        const response = await fetch(apiUrl(`/api/us-market-style/refresh/status?ticket=${encodeURIComponent(refreshTicket!)}`), {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        })
        const json = await response.json()
        if (!response.ok || !json.success) {
          if (response.status >= 500 && ++failures < 3) {
            setUpdateMessage('暂时无法查询进度，正在重试...')
            timer = setTimeout(poll, 10_000)
            return
          }
          throw new Error(json.message || '查询更新失败')
        }
        failures = 0
        const result = json.data
        if (result.runUrl) setRunUrl(result.runUrl)
        if (result.state === 'failed') throw new Error(result.message)
        if (result.state === 'success') {
          if (!isCurrentUsStyleSnapshot(result.snapshot)) throw new Error('更新快照口径不正确，请检查任务。')
          setSnapshot(result.snapshot)
          setStale(result.stale === true)
          setError('')
          setUpdateMessage(`市场数据已更新，最新交易日：${result.snapshot.dataDate}（纽约）。节假日或盘中更新可能仍为最近已完成交易日。`)
          setUpdating(false)
          setRefreshTicket(null)
          return
        }
        setUpdateMessage(result.state === 'running' ? 'GitHub Actions 正在获取行情并写入 Supabase...'
          : result.state === 'publishing' ? '任务已成功，正在确认最新 Supabase 快照...' : '任务排队中，等待 GitHub Actions 启动...')
        timer = setTimeout(poll, 10_000)
      } catch (e) {
        if (!controller.signal.aborted) {
          setUpdateError(true)
          setUpdateMessage(e instanceof Error ? e.message : '更新进度查询失败，请稍后刷新读取。')
          setUpdating(false)
          setRefreshTicket(null)
        }
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [refreshTicket])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(apiUrl('/api/us-market-style/panel'), {
      credentials: 'include', cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || '数据读取失败')
      if (!isCurrentUsStyleSnapshot(json.data)) throw new Error('数据仍为旧基准或不完整，请刷新 VOO 基准快照。')
      setSnapshot(json.data)
      setStale(json.stale === true)
    }).catch((e) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '数据读取失败')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [reload])
  const fullSeries = useMemo(() => Object.fromEntries(
    Object.entries(snapshot?.seriesByTicker || {}).map(([ticker, series]) => [ticker, buildUsPercentileSeries(series)]),
  ), [snapshot])
  const chartSeries = useMemo(() => Object.fromEntries(
    Object.entries(fullSeries).map(([ticker, series]) => [ticker, range ? series.slice(-range) : series]),
  ), [fullSeries, range])
  const rising = snapshot?.items.filter((x) => x.trend === 'up').map((x) => x.ticker).join('、') || '暂无'
  const selectedTickers = Object.keys(fullSeries).filter((ticker) => enabled[ticker] !== false)
  const singleTicker = selectedTickers.length === 1 ? selectedTickers[0] : null
  const scoreZones = useMemo(() => {
    const series = singleTicker ? fullSeries[singleTicker] : null
    const latest = series?.[series.length - 1]
    return latest?.historicalCold != null && latest?.historicalHot != null && latest.historicalCold < latest.historicalHot
      ? { cold: latest.historicalCold, hot: latest.historicalHot } : null
  }, [singleTicker, fullSeries])
  const falling = snapshot?.items.filter((x) => x.trend === 'down').map((x) => x.ticker).join('、') || '暂无'
  const missingTargets = snapshot ? US_STYLE_TARGETS.filter((x) => !snapshot.seriesByTicker[x.ticker]?.length).map((x) => x.ticker) : []

  return (
    <PageContentContainer>
      <PageBreadcrumb items={[{ label: '美股市场风格' }]} />
      <div className="space-y-6">
        <header aria-label="市场数据工具栏" className="space-y-3 border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">美股市场风格</h1>
            <p className="mt-1 text-sm text-[#94A3B8]">基准 VOO · {US_STYLE_TARGETS.length} 只 ETF · 美元复权收盘价</p>
            {snapshot && <p className="mt-2 text-xs text-[#94A3B8]" title={`快照获取：${new Date(snapshot.fetchedAt).toLocaleString('zh-CN')}`}>
              交易日 <span className="font-mono text-slate-200">{snapshot.dataDate}</span>（纽约）
              <span className={cn('ml-3', stale ? 'text-amber-300' : 'text-slate-400')}>{stale ? '数据已过期' : '已载入快照'}</span>
            </p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={updating || loading} onClick={() => void updateMarketData()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A66] px-4 py-2.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#FFA084] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 disabled:opacity-50 motion-reduce:transition-none">
            <RefreshCw className={cn('h-4 w-4', updating && 'animate-spin')} />{updating ? '更新中...' : '更新市场数据'}
          </button>
          <button type="button" disabled={loading || updating} onClick={() => setReload((x) => x + 1)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 motion-reduce:transition-none">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />刷新读取
          </button>
          </div>
          </div>
        {updateMessage && <div role={updateError ? 'alert' : 'status'} aria-live="polite"
          className={cn('border-l-2 px-3 py-2 text-sm', updateError ? 'border-red-400 text-red-200' : 'border-sky-400/50 text-slate-300')}>
          {updateMessage}{runUrl && <a href={runUrl} target="_blank" rel="noopener noreferrer" className="ml-3 underline">查看 GitHub 任务</a>}
        </div>}
        {loading && <p role="status" className="rounded-lg border border-white/10 p-4 text-sm text-[#94A3B8]">正在读取美股动量数据...</p>}
        {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}{snapshot ? ' 当前保留上次读取的数据。' : ''}</p>}
        {stale && snapshot && <p role="alert" className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">数据已超过 7 个自然日未更新，以下仅为历史快照，请检查 GitHub Actions。</p>}
        {missingTargets.length > 0 && <p role="alert" className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">当前快照尚未包含 {missingTargets.join('、')}，请更新数据库发布校验并运行刷新任务；其余标的仍可独立比较。</p>}
        </header>
        {snapshot && <>
          <section className="min-w-0 rounded-lg bg-[#101B24]/80 px-4 py-3 sm:px-5 sm:py-4" aria-labelledby="us-momentum-overview">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="us-momentum-overview" className="text-xs font-medium text-slate-300">动量概览</h2>
              <p className="text-xs text-slate-400">当前快照 · 相对 VOO</p>
            </div>
            <dl className="grid grid-cols-2 gap-y-4 sm:grid-cols-[1.2fr_1fr_1fr]" aria-label="动量摘要">
              <div className="col-span-2 min-w-0 border-b border-white/10 pb-4 sm:col-span-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
                <dt className="text-xs text-slate-400">Score 最高</dt>
                <dd className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xl font-semibold text-white">{snapshot.items[0].ticker}</span>
                  <span className="font-mono text-3xl font-semibold tracking-tight text-white tabular-nums">{fmt(snapshot.items[0].scorePct)}</span>
                  <span className="text-xs text-slate-400">{NAMES[snapshot.items[0].ticker]}</span>
                </dd>
              </div>
              {[
                { title: '动量走强 · 5日', text: rising, Icon: ArrowUpRight, color: 'text-emerald-300' },
                { title: '动量走弱 · 5日', text: falling, Icon: ArrowDownRight, color: 'text-rose-300' },
              ].map(({ title, text, Icon, color }, index) => <div key={title}
                className={cn('min-w-0 sm:px-6', index === 0 ? 'border-r border-white/10 pr-4' : 'pl-4 sm:pr-0')}>
                <dt className="flex items-center gap-1.5 text-xs text-slate-400"><Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', color)} />{title}</dt>
                <dd className="mt-2 text-sm font-semibold leading-6 text-slate-200 sm:text-base">{text}</dd>
              </div>)}
            </dl>
          </section>
          <section className="min-w-0 rounded-lg border border-white/[0.06] bg-[#0C141B]/70 px-4 py-3 sm:px-5" aria-labelledby="us-cross-section">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="us-cross-section" className="text-sm font-semibold text-slate-200">动量截面</h2>
              <p className="text-xs text-[#94A3B8]">Score 降序 · 百分位与自身历史比较</p>
            </div>
            <div className="overflow-x-auto" role="region" aria-label="动量截面表格" tabIndex={0}>
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="text-xs text-[#94A3B8]"><tr>
                  {[
                    { label: '标的 / 风格' }, { label: 'Score', tip: '相对 VOO 的 RPS 偏离 MA50 的百分比' },
                    { label: '5日变化', tip: 'Score 相比5个共同交易日前的变化，单位：百分点（pp）' },
                    { label: '20日超额', tip: '20个共同交易日相对 VOO 的收益' },
                    { label: '历史百分位', tip: '自身此前五年可用 Score 中的位置，0–100，至少252个历史样本' },
                    { label: '冷热区域', tip: '百分位≤10过冷，≥90过热，其余为其它；不代表必然反转' },
                    { label: '动量状态' },
                  ].map((column, index) => <th key={column.label} title={column.tip}
                    className={cn('border-b border-white/10 px-3 py-2.5 font-medium', index >= 1 && index <= 4 && 'text-right')}>{column.label}</th>)}
                </tr></thead>
                <tbody>{snapshot.items.map((item) => {
                  const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus
                  const { percentile, zone, sampleCount } = getUsMomentumCrossSection(fullSeries[item.ticker] || [], snapshot.dataDate)
                  return <tr key={item.ticker} className="border-b border-white/5 transition-colors hover:bg-white/[0.035] motion-reduce:transition-none">
                    <td className="px-3 py-2.5"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[item.ticker] }} /><strong className="font-medium">{item.ticker}</strong><span className="ml-2 text-xs text-[#94A3B8]">{NAMES[item.ticker]}</span></td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{fmt(item.scorePct)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmt(item.scoreChange5dPp, ' pp')}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(item.relativeReturn20dPct)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums" title={`截至 ${snapshot.dataDate}，此前有效 Score 样本：${sampleCount}；与百分位走势图同口径`}>
                      {percentile == null ? '—' : percentile.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5"><span className={cn('inline-flex text-xs',
                      zone === '过热区' ? 'text-orange-300' : zone === '过冷区' ? 'text-sky-300' : 'text-[#94A3B8]')}>{zone}</span></td>
                    <td className="px-3 py-2.5"><span className={cn('inline-flex items-center gap-1.5 text-xs',
                      item.trend === 'up' ? 'text-emerald-300' : item.trend === 'down' ? 'text-rose-300' : 'text-[#94A3B8]')}>
                      <Icon className="h-3.5 w-3.5" />{item.quadrant}</span></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 sm:hidden">左右滑动表格查看全部指标</p>
          </section>
          <section className="min-w-0 space-y-3 rounded-lg border border-white/[0.06] bg-[#0C141B]/70 px-4 py-3 sm:px-5" aria-labelledby="us-trend">
            <div className="space-y-2 border-b border-white/[0.06] pb-3" role="group" aria-label="趋势操作区">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 id="us-trend" className="text-sm font-semibold text-slate-200">动量趋势</h2>
              <div className="inline-flex rounded-lg bg-white/5 p-1" role="group" aria-label="趋势视图">{[
                { value: 'percentile' as const, label: '历史百分位', tip: '比较各标的相对自身历史的冷热程度' },
                { value: 'score' as const, label: 'Score 走势', tip: 'RPS 相对 MA50 归一，观察动量方向' },
                { value: 'relative' as const, label: '相对收益', tip: 'RPS 起点归一为1，观察区间跑赢 VOO 的幅度' },
              ].map((x) => <button type="button" key={x.value} title={x.tip} aria-pressed={view === x.value} onClick={() => setView(x.value)}
                className={cn('rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none',
                  view === x.value ? 'bg-slate-600/50 text-white' : 'text-slate-400 hover:text-white')}>{x.label}</button>)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="时间范围">
                {RANGES.map((x) => <button type="button" key={x.value} aria-pressed={range === x.value} onClick={() => setRange(x.value)}
                  className={cn('rounded px-2.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 motion-reduce:transition-none',
                    range === x.value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>{x.label}</button>)}
              </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-slate-400">比较标的</span>
                {US_STYLE_TARGETS.map((x) => <button type="button" key={x.ticker} aria-pressed={enabled[x.ticker] && !missingTargets.includes(x.ticker)}
                disabled={missingTargets.includes(x.ticker)}
                onClick={() => setEnabled((prev) => ({ ...prev, [x.ticker]: !prev[x.ticker] }))} className={buttonClass(enabled[x.ticker])}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: x.color }} />{x.ticker} {x.name}
              </button>)}</div>
            </div>
            <div className="space-y-3">
            {view === 'score' && (scoreZones ? (
              <div className="flex flex-wrap gap-x-4 text-xs leading-6 text-[#94A3B8]">
                <span className="mr-4 text-orange-300">过热区：Score ≥ {scoreZones.hot.toFixed(2)}%（P90）</span>
                <span className="text-sky-300">过冷区：Score ≤ {scoreZones.cold.toFixed(2)}%（P10）</span>
                <span>{singleTicker} 自身历史 · 最新时点阈值，仅作当前参考</span>
              </div>
            ) : <p className="text-xs text-[#94A3B8]">上行表示相对动量增强；单选标的可显示自身 P10/P90，多标的不使用统一冷热底色。</p>)}
            {view === 'percentile' && <p className="text-xs text-[#94A3B8]">与自身历史比较，≤10 过冷、≥90 过热；不是标的间排名。</p>}
            {view === 'relative' && <p className="text-xs text-[#94A3B8]">各标的相对 VOO 的 RPS 在区间起点归一为 1，上行表示区间跑赢 VOO。</p>}
            <RpsStyleChart seriesByTicker={chartSeries} viewMode={view} tickerNameMap={NAMES} tickerColorMap={COLORS}
              enabledTickers={enabled} compactLegend baseLabel="各标的相对 VOO 的 RPS 在区间起点归一为 1" lockEdges={false} scoreBands={false} scoreZones={view === 'percentile' ? PERCENTILE_ZONES : scoreZones} />
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <p>冷热仅表示历史极端程度，不代表趋势必然反转。</p>
              <span>滚轮缩放 · 拖动 · 悬停查看</span>
            </div>
            </div>
          </section>
        </>}
        <details className="group border-t border-white/[0.06] pt-3 text-sm leading-7 text-[#94A3B8]">
          <summary className="cursor-pointer text-xs font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">计算口径与阅读方法</summary>
          <div className="mt-3 space-y-2">
          <p>RPS = 标的复权收盘价 / VOO 复权收盘价；MA50 = RPS 的 50 交易日简单均线；Score = (RPS / MA50 − 1) × 100%。VOO 自身的 Score 恒为 0，作为参考基线，不参与排名；SCHD 为普通比较标的。</p>
          <p>5 日变化 = 今日 Score − 5 个共同交易日前 Score。变化超过 +0.10 pp 为走强，低于 −0.10 pp 为走弱，其余为平稳；这是过滤微小波动的展示阈值，不是经回测验证的交易信号。20 日相对收益 = (今日 RPS / 20 个交易日前 RPS − 1) × 100%。</p>
          <p>美股调整：使用 Yahoo Finance 含分红、拆股调整的美元收盘价，避免 SCHD/VYM 等分红型 ETF 的除息造成虚假走弱；仅取已完成的纽约交易日，统一共同交易日期，不填补缺失行情。QQQM 历史从其 2020 年上市后开始，不用 QQQ 拼接。</p>
          <p>历史百分位：各 ETF 与自身此前五个日历年内的可用 Score 比较，排除当天和未来数据，至少需要252个此前有效样本；同值取中间排名。≤10 为过冷区，≥90 为过热区，其余为其它。样本不足不画线，表格不判定冷热。切换显示范围和其他标的开关不改变计算窗口。</p>
          <p>单标的 Score 底色采用最新时点自身 P10/P90，不是历史时点可得的回测信号。百分位上升不代表 Score 为正或价格上涨。</p>
          <p>Score 是相对均线的偏离度，不是 RPS 百分位排名或绝对收益。领先走弱仍可能为正收益，落后修复也不代表已经跑赢 VOO。本模块不生成仓位建议，不构成投资建议。</p>
          </div>
        </details>
      </div>
    </PageContentContainer>
  )
}
