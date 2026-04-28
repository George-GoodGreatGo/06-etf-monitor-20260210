import PageBreadcrumb from '@/components/PageBreadcrumb'
import PageContentContainer from '@/components/PageContentContainer'
import {
  CONFIRM_TRAIL12_BACKTEST_AGGREGATE,
  CONFIRM_TRAIL12_BACKTEST_ROWS,
  CONFIRM_TRAIL12_BACKTEST_SOURCE,
  CONFIRM_TRAIL12_METHOD_SECTIONS,
  CONFIRM_TRAIL12_SUMMARY_LINES,
  type ConfirmTrail12MethodSection,
} from '@/utils/confirmTrail12Methodology'

function fmtNumber(value: number, digits = 2, suffix = ''): string {
  return `${value.toFixed(digits)}${suffix}`
}

function pickSections(titles: readonly string[]): ConfirmTrail12MethodSection[] {
  return titles
    .map((title) => CONFIRM_TRAIL12_METHOD_SECTIONS.find((section) => section.title === title))
    .filter((section): section is ConfirmTrail12MethodSection => Boolean(section))
}

const overviewSections = pickSections(['策略定位', '指标定义'])
const ruleSections = pickSections(['买入规则', '卖出规则', '增强风控', '边界条件'])
const appendixSections = pickSections(['实现口径'])

const researchHighlights = [
  { label: '样本平均总收益', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgTotalReturnPct, 2, '%') },
  { label: '样本平均 CAGR', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgCagrPct, 2, '%') },
  { label: '样本平均最大回撤', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgMaxDrawdownPct, 2, '%') },
  { label: '样本平均交易次数', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgTrades, 1) },
  { label: '样本平均胜率', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgWinRatePct, 2, '%') },
  { label: '样本平均持有天数', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgHoldDays, 2) },
  { label: '样本平均持仓暴露', value: fmtNumber(CONFIRM_TRAIL12_BACKTEST_AGGREGATE.avgExposurePct, 2, '%') },
]

export default function MarketRpsMethodology() {
  return (
    <PageContentContainer className="space-y-5">
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '分析方法' },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">Methodology / PRD Draft</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">confirmTrail12 分析方法</div>
          <div className="mt-3 max-w-[920px] space-y-2 text-sm leading-6 text-[#A9B6CC]">
            <p>
              本页用于归档 `confirmTrail12` 的正式产品口径，统一回答默认买点怎么触发、确认卖点如何判定、12%
              trailing stop 为什么存在，以及研究样本回测结果如何。
            </p>
            <p>
              页面结构按“总述、规则正文、研究结果”收敛，目标是让产品、研发和研究复用时都能直接把这里当作 PRD
              或方法说明的基础版本。
            </p>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <div>
              <div className="text-sm font-semibold text-white">核心结论</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#CBD5E1]">
                {CONFIRM_TRAIL12_SUMMARY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="text-sm font-semibold text-white">研究摘要</div>
              <dl className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {researchHighlights.map((item) => (
                  <div key={item.label} className="border-b border-white/5 pb-2">
                    <dt className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{item.label}</dt>
                    <dd className="mt-1 font-mono text-sm text-[#E6EDF7]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-lg font-semibold tracking-tight text-white">1. 规则正文</div>
          <div className="mt-1 text-sm leading-6 text-[#94A3B8]">
            以下正文按正式说明文档的阅读顺序展开，先交代策略定位与指标，再依次说明买入、卖出、风控和边界。
          </div>
        </div>

        <article className="space-y-8 px-5 py-5">
          <div className="space-y-5">
            <div className="text-base font-semibold text-white">1.1 策略概述与指标定义</div>
            {overviewSections.map((section, index) => (
              <div
                key={section.title}
                className={index === 0 ? '' : 'border-t border-white/5 pt-5'}
              >
                <div className="text-sm font-semibold text-[#E6EDF7]">{section.title}</div>
                <p className="mt-2 text-sm leading-6 text-[#A9B6CC]">{section.description}</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#CBD5E1]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-5 border-t border-white/10 pt-6">
            <div className="text-base font-semibold text-white">1.2 信号与风控规则</div>
            {ruleSections.map((section, index) => (
              <div
                key={section.title}
                className={index === 0 ? '' : 'border-t border-white/5 pt-5'}
              >
                <div className="text-sm font-semibold text-[#E6EDF7]">{section.title}</div>
                <p className="mt-2 text-sm leading-6 text-[#A9B6CC]">{section.description}</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#CBD5E1]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">2. 数据口径与样本回测</div>
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

        <div className="space-y-5 px-4 py-4">
          {appendixSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="text-sm font-semibold text-white">{section.title}</div>
              <p className="text-sm leading-6 text-[#A9B6CC]">{section.description}</p>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#CBD5E1]">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="overflow-x-auto">
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
        </div>
      </section>
    </PageContentContainer>
  )
}
