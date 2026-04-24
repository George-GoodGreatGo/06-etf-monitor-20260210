import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Top100Table from '@/components/Top100Table'
import type { SortDir } from '@/components/SortableTh'
import RpsCustomQueryCharts from '@/components/charts/RpsCustomQueryCharts'
import { cn } from '@/lib/utils'
import type { EtfTopRow, Top100SortKey } from '@/utils/etfApi'
import type { RpsStyleSeriesPoint } from '@/utils/marketApi'

type MockPreset = {
  ticker: string
  code: string
  name: string
  benchmarkName: string
  note: string
  series: RpsStyleSeriesPoint[]
  turnover: number
  volume: number
  turnoverChangePct1d: number
  turnoverChangePct7dAvg: number
  z90: number
}

function fmt(value: number | null | undefined, digits = 4): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildBusinessDays(count: number, endDate: string): string[] {
  const output: string[] = []
  const cursor = new Date(`${endDate}T00:00:00Z`)
  while (output.length < count) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) output.push(formatDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return output.reverse()
}

function movingAverage(values: number[], windowSize: number, index: number): number | null {
  if (index + 1 < windowSize) return null
  let sum = 0
  for (let i = index - windowSize + 1; i <= index; i += 1) {
    sum += values[i]
  }
  return sum / windowSize
}

function buildPreset(
  ticker: string,
  name: string,
  benchmarkName: string,
  endDate: string,
  mode: 'steady' | 'stress',
): MockPreset {
  const days = buildBusinessDays(360, endDate)
  const code = ticker.split('.')[0] || ticker
  let target = mode === 'steady' ? 1.06 : 0.94
  let benchmark = 1
  const rawRpsValues: number[] = []

  const series = days.map((date, index) => {
    const wave = Math.sin(index / (mode === 'steady' ? 11 : 7)) * (mode === 'steady' ? 0.006 : 0.012)
    const extra = Math.cos(index / (mode === 'steady' ? 23 : 13)) * 0.004
    const targetDrift = mode === 'steady' ? 0.0018 : index < 110 ? -0.0008 : 0.0026
    const benchmarkDrift = mode === 'steady' ? 0.0011 : 0.0012
    target *= 1 + targetDrift + wave + extra
    benchmark *= 1 + benchmarkDrift + Math.sin(index / 17) * 0.003

    const rpsRaw = target / benchmark
    rawRpsValues.push(rpsRaw)
    const rpsMa50 = movingAverage(rawRpsValues, 50, index)
    let scorePct = rpsMa50 ? ((rpsRaw / rpsMa50) - 1) * 100 : null

    // Inject sparse gaps to verify charts still render cleanly under missing Score points.
    if (mode === 'stress' && index > 65 && index % 19 === 0) scorePct = null
    if (mode === 'stress' && index > 140 && index % 27 === 0) scorePct = null

    return {
      date,
      ticker,
      benchmarkTicker: 'H30269',
      targetCloseQfq: Number((target * 100).toFixed(4)),
      benchmarkCloseQfq: Number((benchmark * 100).toFixed(4)),
      rpsRaw: Number(rpsRaw.toFixed(6)),
      rpsMa50: rpsMa50 ? Number(rpsMa50.toFixed(6)) : null,
      scorePct: typeof scorePct === 'number' && Number.isFinite(scorePct) ? Number(scorePct.toFixed(4)) : null,
    } satisfies RpsStyleSeriesPoint
  })

  return {
    ticker,
    code,
    name,
    benchmarkName,
    note:
      mode === 'steady'
        ? '平稳上行样本：覆盖超过1年的交易日，用于检查主图加副图结构与默认最近1年视窗。'
        : '压力样本：覆盖超过1年的交易日，并插入局部震荡与稀疏 Score 缺口，用于观察非理想序列下的稳定性。',
    series,
    turnover: mode === 'steady' ? 2_580_000_000 : 1_860_000_000,
    volume: mode === 'steady' ? 385_000_000 : 246_000_000,
    turnoverChangePct1d: mode === 'steady' ? 8.46 : -3.82,
    turnoverChangePct7dAvg: mode === 'steady' ? 15.27 : 4.18,
    z90: mode === 'steady' ? 2.14 : 1.36,
  }
}

function normalizeMockTicker(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase()
}

function resolvePreset(presets: MockPreset[], value: string | null | undefined): MockPreset {
  const normalized = normalizeMockTicker(value)
  return (
    presets.find((item) => item.ticker === normalized || item.code === normalized) ??
    presets[0]
  )
}

export default function DevRpsCustomQueryMock() {
  const presets = useMemo<MockPreset[]>(
    () => [
      buildPreset('159915.SZ', '创业板ETF', '红利低波全收益指数（Mock）', '2026-04-21', 'steady'),
      buildPreset('512050.SH', '中证A500ETF', '红利低波全收益指数（Mock）', '2026-04-21', 'steady'),
      buildPreset('510300.SH', '沪深300ETF', '红利低波全收益指数（Mock）', '2026-04-21', 'stress'),
    ],
    [],
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortKey, setSortKey] = useState<Top100SortKey>('turnover')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [queryInput, setQueryInput] = useState<string>(() => resolvePreset(presets, searchParams.get('ticker')).code)

  const active = useMemo(() => resolvePreset(presets, searchParams.get('ticker')), [presets, searchParams])
  const latest = active.series[active.series.length - 1] ?? null
  const inputTicker = normalizeMockTicker(searchParams.get('ticker'))
  const autoQueryActive = inputTicker.length > 0

  useEffect(() => {
    setQueryInput(active.code)
  }, [active.code])

  const rows = useMemo<EtfTopRow[]>(
    () =>
      presets.map((preset) => ({
        code: preset.code,
        name: preset.name,
        latestTradingDate: preset.series[preset.series.length - 1]?.date ?? '2026-04-21',
        volume: preset.volume,
        turnover: preset.turnover,
        turnoverChangePct1d: preset.turnoverChangePct1d,
        turnoverChangePct7dAvg: preset.turnoverChangePct7dAvg,
        z90: preset.z90,
        dataStatus: 'complete',
      })),
    [presets],
  )

  function onToggleSort(nextKey: Top100SortKey) {
    if (nextKey === sortKey) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(nextKey)
    setSortDir(nextKey === 'code' || nextKey === 'name' ? 'asc' : 'desc')
  }

  function applyTicker(nextTicker: string) {
    const normalized = normalizeMockTicker(nextTicker)
    if (!normalized) {
      setSearchParams({})
      return
    }
    setSearchParams({ ticker: normalized })
  }

  return (
    <main className="min-h-screen bg-[#050A0B] px-4 py-8 text-[#E6EDF7] sm:px-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-4">
        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xl font-semibold tracking-tight text-white">RPS 动量分析 Mock 验收页</div>
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
                <p>该页面仅用于本地开发环境回归验收，绕开登录态模拟“Top200 列表到 RPS分析，再到动量分析自动带参”的链路。</p>
                <p>点击下方 mock 列表中 `RPS分析` 列的 `查看` 按钮，会新开当前 mock 页，并通过 `ticker` 参数自动切换到对应样本。</p>
              </div>
            </div>

            <div className="min-w-[280px] rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">当前样本</div>
                <div className="font-mono text-[#E6EDF7]">
                  {active.code}（{active.name}）
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">最新交易日</div>
                <div className="font-mono text-[#A9B6CC]">{latest?.date ?? '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">初始化来源</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{autoQueryActive ? 'URL ticker' : '默认样本'}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="text-lg font-semibold tracking-tight text-white">Top200 列表 Mock 入口</div>
            <div className="mt-1 text-sm leading-relaxed text-[#94A3B8]">
              该列表直接复用真实 `Top100Table` 的操作列样式与新开窗口行为，仅将 `RPS分析` 列目标地址改为当前 mock 页，便于本地回归。
            </div>
          </div>
          <div className="px-4 py-4">
            <Top100Table
              rows={rows}
              loading={false}
              error={null}
              keyword=""
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={onToggleSort}
              buildRpsAnalysisHref={(row) => `/dev/rps-custom-query-mock?ticker=${encodeURIComponent(row.code)}`}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold tracking-tight text-white">Mock 动量分析结果</div>
                <div className="mt-1 text-sm leading-relaxed text-[#94A3B8]">{active.note}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.ticker}
                    type="button"
                    onClick={() => applyTicker(preset.code)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm transition',
                      preset.ticker === active.ticker
                        ? 'border-white/20 bg-white/10 text-[#E6EDF7]'
                        : 'border-white/10 bg-transparent text-[#A9B6CC] hover:border-white/15 hover:text-[#E6EDF7]',
                    )}
                  >
                    {preset.code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-4">
            <form
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
              onSubmit={(e) => {
                e.preventDefault()
                applyTicker(queryInput)
              }}
            >
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="输入 mock ETF 代码，如 159915、512050、510300"
                className="h-11 flex-1 rounded-full border border-[rgba(148,163,184,0.20)] bg-[rgba(15,23,42,0.96)] px-4 font-mono text-base text-[#F8FAFC] outline-none transition placeholder:text-[#8CA3C7] focus:border-[rgba(125,211,252,0.48)]"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(125,211,252,0.24),rgba(203,184,255,0.24))] px-6 text-sm font-semibold text-white transition hover:bg-[linear-gradient(135deg,rgba(125,211,252,0.34),rgba(203,184,255,0.34))]"
              >
                模拟查询
              </button>
            </form>
            <div className="mt-2 text-xs text-[#94A3B8]">
              当前 URL 参数：{inputTicker || '未传入'}；当参数缺失或不命中样本时，页面回退到默认 `159915`。
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(96,165,250,0.12),rgba(15,23,42,0.92))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.28)]">
              <div className="text-xs uppercase tracking-[0.18em] text-[#93C5FD]">Data Date</div>
              <div className="mt-3 font-mono text-2xl font-semibold text-[#F8FAFC]">{latest?.date ?? '—'}</div>
              <div className="mt-1 text-xs text-[#94A3B8]">Mock 查询结果会随 URL 参数切换，时间轴与摘要使用同一口径。</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.96))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.24)]">
              <div className="text-xs text-[#94A3B8]">输入框</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC]">{queryInput || '—'}</div>
              <div className="mt-1 text-xs text-[#64748B]">用于确认页面初始化后会带入当前 ETF 代码。</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.96))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.24)]">
              <div className="text-xs text-[#94A3B8]">最新 RPS</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC]">{fmt(latest?.rpsRaw, 4)}</div>
              <div className="mt-1 text-xs text-[#64748B]">分母基准：{active.benchmarkName}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.96))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.24)]">
              <div className="text-xs text-[#94A3B8]">最新 RPS(MA50)</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC]">{fmt(latest?.rpsMa50, 4)}</div>
              <div className="mt-1 text-xs text-[#64748B]">用于观察平滑中枢与 Score 关系。</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.96))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.24)]">
              <div className="text-xs text-[#94A3B8]">最新 RPS Score</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC]">{fmt(latest?.scorePct, 2)}</div>
              <div className="mt-1 text-xs text-[#64748B]">摘要区、图表区都会跟随当前样本联动更新。</div>
            </div>
          </div>
        </section>

        <RpsCustomQueryCharts
          ticker={active.ticker}
          tickerName={active.name}
          benchmarkName={active.benchmarkName}
          series={active.series}
        />
      </div>
    </main>
  )
}
