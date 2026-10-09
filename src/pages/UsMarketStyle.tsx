import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import PageContentContainer from '@/components/PageContentContainer'
import PageBreadcrumb from '@/components/PageBreadcrumb'
import RpsStyleChart from '@/components/charts/RpsStyleChart'
import { apiUrl } from '@/utils/apiBase'
import { cn } from '@/lib/utils'
import { buildUsPercentileSeries, US_STYLE_TARGETS, type UsStyleSnapshot } from '@/utils/usMarketStyle'

const NAMES = Object.fromEntries(US_STYLE_TARGETS.map((x) => [x.ticker, x.name]))
const COLORS = Object.fromEntries(US_STYLE_TARGETS.map((x) => [x.ticker, x.color]))
const PERCENTILE_ZONES = { cold: 10, hot: 90 }
const RANGES = [{ value: 63, label: '3个月' }, { value: 126, label: '6个月' },
  { value: 252, label: '1年' }, { value: 504, label: '2年' }, { value: 0, label: '全部' }]
const fmt = (v: number, suffix = '%') => `${v > 0 ? '+' : ''}${v.toFixed(2)}${suffix}`
const buttonClass = (active: boolean) => cn(
  'rounded-md border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]',
  active ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-[#94A3B8] hover:bg-white/5',
)

export default function UsMarketStyle() {
  const [snapshot, setSnapshot] = useState<UsStyleSnapshot | null>(null)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [view, setView] = useState<'score' | 'relative' | 'percentile'>('percentile')
  const [range, setRange] = useState(252)
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(US_STYLE_TARGETS.map((x) => [x.ticker, true])),
  )
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(apiUrl('/api/us-market-style/panel'), {
      credentials: 'include', cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(json.message || '数据读取失败')
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
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">美股市场风格</h1>
            <p className="mt-2 text-sm text-[#94A3B8]">以 SCHD（美国股息权益 ETF）为基准，观察 {US_STYLE_TARGETS.length} 只美股 ETF 的相对动量及变化方向。</p>
            {snapshot && <p className="mt-2 text-xs text-[#94A3B8]">数据交易日：{snapshot.dataDate}（纽约） · 更新：{new Date(snapshot.fetchedAt).toLocaleString('zh-CN')} · 美元复权收盘价</p>}
          </div>
          <button type="button" disabled={loading} onClick={() => setReload((x) => x + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-50">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />刷新读取
          </button>
        </header>
        {loading && <p role="status" className="rounded-lg border border-white/10 p-4 text-sm text-[#94A3B8]">正在读取美股动量数据...</p>}
        {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}{snapshot ? ' 当前保留上次读取的数据。' : ''}</p>}
        {stale && snapshot && <p role="alert" className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">数据已超过 7 个自然日未更新，以下仅为历史快照，请检查 GitHub Actions。</p>}
        {missingTargets.length > 0 && <p role="alert" className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">当前快照尚未包含 {missingTargets.join('、')}，请更新数据库发布校验并运行刷新任务；其余标的仍可独立比较。</p>}
        {snapshot && <>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: 'Score 最高', text: `${snapshot.items[0].ticker} · ${fmt(snapshot.items[0].scorePct)}` },
              { title: '动量走强 · 5日', text: rising },
              { title: '动量走弱 · 5日', text: falling },
            ].map((card) => <div key={card.title} className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4">
              <div className="text-xs text-[#94A3B8]">{card.title}</div>
              <div className="mt-2 text-lg font-semibold text-white">{card.text}</div>
            </div>)}
          </div>
          <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A]">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white">动量截面</h2>
              <p className="mt-1 text-xs text-[#94A3B8]">按 Score 降序排列。Score 正负表示相对强弱，5 日变化表示增强或减弱，两者需一起看。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="text-xs text-[#94A3B8]"><tr>
                  {['标的 / 风格', 'Score', 'Score 5日变化（百分点）', '20日相对 SCHD 收益', '动量状态'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}
                </tr></thead>
                <tbody>{snapshot.items.map((item) => {
                  const Icon = item.trend === 'up' ? ArrowUpRight : item.trend === 'down' ? ArrowDownRight : Minus
                  return <tr key={item.ticker} className="border-t border-white/5 hover:bg-white/[0.025]">
                    <td className="px-4 py-4"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[item.ticker] }} /><strong>{item.ticker}</strong><span className="ml-2 text-[#94A3B8]">{NAMES[item.ticker]}</span></td>
                    <td className="px-4 py-4 font-mono">{fmt(item.scorePct)}</td>
                    <td className="px-4 py-4 font-mono">{fmt(item.scoreChange5dPp, ' pp')}</td>
                    <td className="px-4 py-4 font-mono">{fmt(item.relativeReturn20dPct)}</td>
                    <td className="px-4 py-4"><span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                      item.trend === 'up' ? 'bg-emerald-400/10 text-emerald-300' : item.trend === 'down' ? 'bg-rose-400/10 text-rose-300' : 'bg-white/5 text-[#94A3B8]')}>
                      <Icon className="h-3.5 w-3.5" />{item.quadrant}</span></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          </section>
          <section className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4">
            <h2 className="text-lg font-semibold text-white">动量趋势</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">Score 向上表示相对动量在增强；起点归一曲线上行表示该区间跑赢 SCHD。滚轮缩放、拖动观察，悬停查看数值。</p>
            <div className="my-4 space-y-3">
              <div className="flex flex-wrap gap-2">{[
                { value: 'percentile' as const, label: '历史动量百分位（多标的比较）' },
                { value: 'score' as const, label: 'Score 走势（MA50归一）' },
                { value: 'relative' as const, label: 'RPS 起点归一' },
              ].map((x) => <button type="button" key={x.value} aria-pressed={view === x.value} onClick={() => setView(x.value)} className={buttonClass(view === x.value)}>{x.label}</button>)}</div>
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[#94A3B8]">时间范围</span>
                {RANGES.map((x) => <button type="button" key={x.value} aria-pressed={range === x.value} onClick={() => setRange(x.value)} className={buttonClass(range === x.value)}>{x.label}</button>)}
              </div>
              <div className="flex flex-wrap gap-2">{US_STYLE_TARGETS.map((x) => <button type="button" key={x.ticker} aria-pressed={enabled[x.ticker] && !missingTargets.includes(x.ticker)}
                disabled={missingTargets.includes(x.ticker)}
                onClick={() => setEnabled((prev) => ({ ...prev, [x.ticker]: !prev[x.ticker] }))} className={buttonClass(enabled[x.ticker])}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: x.color }} />{x.ticker} {x.name}
              </button>)}</div>
            </div>
            {view === 'score' && (scoreZones ? (
              <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.025] p-3 text-xs leading-6 text-[#94A3B8]">
                <span className="mr-4 text-orange-300">过热区：Score ≥ {scoreZones.hot.toFixed(2)}%（P90）</span>
                <span className="text-sky-300">过冷区：Score ≤ {scoreZones.cold.toFixed(2)}%（P10）</span>
                <p>{singleTicker} 自身此前五年可用 Score 的 P10/P90，排除最新交易日。底色采用最新时点阈值，仅作当前历史参考，不用于回测。</p>
                <p>过热不代表立即下跌，过冷不代表立即反弹。</p>
              </div>
            ) : <p className="mb-3 text-xs text-[#94A3B8]">Score 多标的图不使用统一冷热阈值。仅选一只标的可显示其自身 P10/P90（至少 252 个历史有效 Score）；比较冷热程度请切换百分位视图。</p>)}
            {view === 'percentile' && <div className="mb-3 rounded-lg border border-white/10 p-3 text-xs leading-6 text-[#94A3B8]">
              <p>各 ETF 与自身此前五年的可用 Score 比较，纵轴 0–100；不是六只 ETF 之间排名。≥90 为过热，≤10 为过冷。</p>
              <p>每个历史时点排除当天及未来数据，至少需要 252 个此前有效 Score，样本不足的日期不画线。切换显示范围不改变计算窗口。</p>
              <p>百分位上升只表示相对自身历史的位置变高，不代表 Score 为正或价格上涨，也不是反转信号。</p>
            </div>}
            <RpsStyleChart seriesByTicker={chartSeries} viewMode={view} tickerNameMap={NAMES} tickerColorMap={COLORS}
              enabledTickers={enabled} baseLabel="各标的相对 SCHD 的 RPS 在区间起点归一为 1" lockEdges={false} scoreBands={false} scoreZones={view === 'percentile' ? PERCENTILE_ZONES : scoreZones} />
          </section>
        </>}
        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4 text-sm leading-7 text-[#94A3B8]">
          <h2 className="mb-2 font-semibold text-white">计算口径与阅读方法</h2>
          <p>RPS = 标的复权收盘价 / SCHD 复权收盘价；MA50 = RPS 的 50 交易日简单均线；Score = (RPS / MA50 − 1) × 100%。SCHD 自身的 Score 恒为 0，作为参考基线，不参与排名。</p>
          <p>5 日变化 = 今日 Score − 5 个共同交易日前 Score。变化超过 +0.10 pp 为走强，低于 −0.10 pp 为走弱，其余为平稳；这是过滤微小波动的展示阈值，不是经回测验证的交易信号。20 日相对收益 = (今日 RPS / 20 个交易日前 RPS − 1) × 100%。</p>
          <p>美股调整：使用 Yahoo Finance 含分红、拆股调整的美元收盘价，避免 SCHD/VYM 等分红型 ETF 的除息造成虚假走弱；仅取已完成的纽约交易日，统一共同交易日期，不填补缺失行情。QQQM 历史从其 2020 年上市后开始，不用 QQQ 拼接。</p>
          <p>Score 是相对均线的偏离度，不是 RPS 百分位排名或绝对收益。领先走弱仍可能为正收益，落后修复也不代表已经跑赢 SCHD。本模块不生成仓位建议，不构成投资建议。</p>
        </section>
      </div>
    </PageContentContainer>
  )
}
