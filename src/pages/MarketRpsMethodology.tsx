import PageBreadcrumb from '@/components/PageBreadcrumb'
import PageContentContainer from '@/components/PageContentContainer'
import {
  CONFIRM_TRAIL12_BACKTEST_AGGREGATE,
  CONFIRM_TRAIL12_BACKTEST_ROWS,
  CONFIRM_TRAIL12_BACKTEST_SOURCE,
  CONFIRM_TRAIL12_METHOD_SECTIONS,
} from '@/utils/confirmTrail12Methodology'

function fmtNumber(value: number, digits = 2, suffix = ''): string {
  return `${value.toFixed(digits)}${suffix}`
}

export default function MarketRpsMethodology() {
  return (
    <PageContentContainer className="space-y-5">
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '分析方法' },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-5 shadow-lg">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[860px]">
            <div className="text-xl font-semibold tracking-tight text-white">confirmTrail12 分析方法</div>
            <div className="mt-2 space-y-2 text-sm leading-6 text-[#A9B6CC]">
              <p>
                该页面用于归档 `confirmTrail12` 的产品口径，方便用户理解默认买卖点，也方便后续 PRD、帮助文档和研究复盘直接复用。
              </p>
              <p>
                本轮页面化目标是把“买入怎么触发、卖出怎么确认、12% 风控为什么存在、样本 ETF 回测结果如何”统一沉淀为一份稳定说明。
              </p>
            </div>
          </div>

          <div className="min-w-[280px] rounded-lg border border-[rgba(125,211,252,0.18)] bg-[rgba(15,23,42,0.76)] px-4 py-3 text-xs text-[#CBD5E1]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#93C5FD]">研究摘要</div>
            <div className="mt-2 space-y-1.5 leading-5">
              <div>样本平均总收益：{fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgTotalReturnPct, 2, '%')}</div>
              <div>样本平均 CAGR：{fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgCagrPct, 2, '%')}</div>
              <div>样本平均最大回撤：{fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgMaxDrawdownPct, 2, '%')}</div>
              <div>样本平均交易次数：{fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgTrades, 1)}</div>
              <div>样本平均持仓暴露：{fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgExposurePct, 2, '%')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {CONFIRM_TRAIL12_METHOD_SECTIONS.map((section) => (
          <article key={section.title} className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
            <div className="text-base font-semibold text-white">{section.title}</div>
            <div className="mt-2 text-sm leading-6 text-[#A9B6CC]">{section.description}</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#CBD5E1]">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">样本 ETF 回测结果</div>
              <div className="mt-1 text-sm leading-6 text-[#94A3B8]">
                {CONFIRM_TRAIL12_BACKTEST_SOURCE}
              </div>
            </div>
            <div className="text-xs text-[#64748B]">
              平均胜率 {fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgWinRatePct, 2, '%')} | 平均持有天数{' '}
              {fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgHoldDays, 2)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-4">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-[#A9B6CC]">
              <tr>
                <th className="px-3 py-2 text-left">ETF</th>
                <th className="px-3 py-2 text-left">样本区间</th>
                <th className="px-3 py-2 text-right">总收益</th>
                <th className="px-3 py-2 text-right">CAGR</th>
                <th className="px-3 py-2 text-right">最大回撤</th>
                <th className="px-3 py-2 text-right">交易次数</th>
                <th className="px-3 py-2 text-right">胜率</th>
                <th className="px-3 py-2 text-right">平均持有天数</th>
                <th className="px-3 py-2 text-right">持仓暴露</th>
              </tr>
            </thead>
            <tbody>
              {CONFIRM_TRAIL12_BACKTEST_ROWS.map((row) => (
                <tr key={row.ticker} className="border-t border-white/5">
                  <td className="px-3 py-2 text-[#E6EDF7]">
                    <div className="font-medium">{row.name}</div>
                    <div className="font-mono text-xs text-[#94A3B8]">{row.ticker}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[#CBD5E1]">{row.sampleRange}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#FCA5A5]">{fmtNumber(row.totalReturnPct, 2, '%')}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#F8FAFC]">{fmtNumber(row.cagrPct, 2, '%')}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#6EE7B7]">{fmtNumber(row.maxDrawdownPct, 2, '%')}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#F8FAFC]">{row.trades}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#F8FAFC]">{fmtNumber(row.winRatePct, 2, '%')}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#F8FAFC]">{fmtNumber(row.avgHoldDays, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#CBD5E1]">{fmtNumber(row.exposurePct, 2, '%')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageContentContainer>
  )
}
