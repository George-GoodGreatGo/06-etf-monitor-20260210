import { useMemo, useState } from 'react'
import RpsCustomQueryCharts from '@/components/charts/RpsCustomQueryCharts'
import type { RpsStyleSeriesPoint } from '@/utils/marketApi'
import { cn } from '@/lib/utils'

type MockPreset = {
  ticker: string
  name: string
  benchmarkName: string
  note: string
  series: RpsStyleSeriesPoint[]
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
  const days = buildBusinessDays(240, endDate)
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
    name,
    benchmarkName,
    note:
      mode === 'steady'
        ? '平稳上行样本：用于检查三图区的阅读节奏、容器间距和默认渲染效果。'
        : '压力样本：插入局部震荡与稀疏 Score 缺口，用于观察非理想序列下的渲染稳定性。',
    series,
  }
}

export default function DevRpsCustomQueryMock() {
  const presets = useMemo<MockPreset[]>(
    () => [
      buildPreset('159915.SZ', '创业板ETF', '红利低波全收益指数（Mock）', '2026-04-21', 'steady'),
      buildPreset('510300.SH', '沪深300ETF', '红利低波全收益指数（Mock）', '2026-04-21', 'stress'),
    ],
    [],
  )
  const [activeTicker, setActiveTicker] = useState(presets[0]?.ticker ?? '159915.SZ')
  const active = presets.find((item) => item.ticker === activeTicker) ?? presets[0]
  const latest = active.series[active.series.length - 1] ?? null

  return (
    <main className="min-h-screen bg-[#050A0B] px-4 py-8 text-[#E6EDF7] sm:px-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-4">
        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xl font-semibold tracking-tight text-white">RPS 自定义查询 Mock 验收页</div>
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
                <p>该页面仅用于本地开发环境可视化验收，绕开登录态直接渲染“三图联动”模块。</p>
                <p>可切换两组伪造 ETF 数据，重点观察图表布局、分区节奏、数据渲染和切换标的后的视图重置。</p>
              </div>
            </div>

            <div className="min-w-[280px] rounded-lg border border-[#1E293B] bg-[#0B1220] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">当前样本</div>
                <div className="font-mono text-[#E6EDF7]">
                  {active.ticker}（{active.name}）
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">最新交易日</div>
                <div className="font-mono text-[#A9B6CC]">{latest?.date ?? '—'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-[#94A3B8]">最新 Score</div>
                <div className="font-mono text-sm font-semibold text-[#F8FAFC]">{fmt(latest?.scorePct, 2)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold tracking-tight text-white">样本切换</div>
                <div className="mt-1 text-sm leading-relaxed text-[#94A3B8]">{active.note}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.ticker}
                    type="button"
                    onClick={() => setActiveTicker(preset.ticker)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm transition',
                      preset.ticker === activeTicker
                        ? 'border-white/20 bg-white/10 text-[#E6EDF7]'
                        : 'border-white/10 bg-transparent text-[#A9B6CC] hover:border-white/15 hover:text-[#E6EDF7]',
                    )}
                  >
                    {preset.ticker}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(96,165,250,0.12),rgba(15,23,42,0.92))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.28)]">
              <div className="text-xs uppercase tracking-[0.18em] text-[#93C5FD]">Data Date</div>
              <div className="mt-3 font-mono text-2xl font-semibold text-[#F8FAFC]">{latest?.date ?? '—'}</div>
              <div className="mt-1 text-xs text-[#94A3B8]">Mock 时间轴与三图顶部摘要共用同一日期口径。</div>
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
              <div className="mt-1 text-xs text-[#64748B]">压力样本会稀疏插入空值，便于观察渲染稳定性。</div>
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
