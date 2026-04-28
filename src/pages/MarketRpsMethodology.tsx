import PageBreadcrumb from '@/components/PageBreadcrumb'
import PageContentContainer from '@/components/PageContentContainer'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MOMENTUM_STRATEGIES,
  buildMomentumAnalysisPath,
  buildMomentumMethodPath,
  getMomentumStrategy,
  type MomentumMethodSection,
} from '@/utils/momentumStrategies'

function fmtNumber(value: number, digits = 2, suffix = ''): string {
  return `${value.toFixed(digits)}${suffix}`
}

function pickSections(sections: readonly MomentumMethodSection[], titles: readonly string[]): MomentumMethodSection[] {
  return titles
    .map((title) => sections.find((section) => section.title === title))
    .filter((section): section is MomentumMethodSection => Boolean(section))
}

export default function MarketRpsMethodology() {
  const [searchParams] = useSearchParams()
  const strategy = getMomentumStrategy(searchParams.get('strategy'))
  const overviewSections = pickSections(strategy.sections, ['策略定位', '指标定义'])
  const ruleSections = pickSections(strategy.sections, ['买入规则', '卖出规则', '增强风控', '边界条件'])
  const appendixSections = pickSections(strategy.sections, ['实现口径'])
  const researchHighlights = strategy.backtestAggregate
    ? [
        { label: '样本平均总收益', value: fmtNumber(strategy.backtestAggregate.avgTotalReturnPct, 2, '%') },
        { label: '样本平均 CAGR', value: fmtNumber(strategy.backtestAggregate.avgCagrPct, 2, '%') },
        { label: '样本平均最大回撤', value: fmtNumber(strategy.backtestAggregate.avgMaxDrawdownPct, 2, '%') },
        { label: '样本平均交易次数', value: fmtNumber(strategy.backtestAggregate.avgTrades, 1) },
        { label: '样本平均胜率', value: fmtNumber(strategy.backtestAggregate.avgWinRatePct, 2, '%') },
        { label: '样本平均持有天数', value: fmtNumber(strategy.backtestAggregate.avgHoldDays, 2) },
        { label: '样本平均持仓暴露', value: fmtNumber(strategy.backtestAggregate.avgExposurePct, 2, '%') },
      ]
    : []
  const hasBacktestRows = Array.isArray(strategy.backtestRows) && strategy.backtestRows.length > 0

  return (
    <PageContentContainer className="space-y-5">
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '分析方法' },
        ]}
      />

      <section className="rounded-lg border border-[#1E293B] bg-[#0F172A] px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">Strategy Selector</div>
            <div className="mt-1 text-base font-semibold text-white">策略选择</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {MOMENTUM_STRATEGIES.map((item) => {
              const isActive = item.id === strategy.id
              return (
                <Link
                  key={item.id}
                  to={buildMomentumMethodPath(item.id)}
                  className={
                    isActive
                      ? 'inline-flex items-center gap-2 rounded-full border border-[rgba(125,211,252,0.42)] bg-[rgba(14,116,144,0.18)] px-3 py-1 text-[12px] font-semibold text-[#E0F2FE]'
                      : 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0B1220] px-3 py-1 text-[12px] font-semibold text-[#A9B6CC] transition hover:border-white/20 hover:text-white'
                  }
                  title={item.selectorDescription}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] font-medium text-[#7DD3FC]">{item.roleLabel}</span>
                </Link>
              )
            })}
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#A9B6CC]">{strategy.selectorDescription}</p>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] shadow-lg">
        <div className="border-b border-white/10 px-5 py-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">Methodology / PRD Draft</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{strategy.methodTitle}</div>
            <div className="mt-3 max-w-[920px] space-y-2 text-sm leading-6 text-[#A9B6CC]">
              {strategy.methodLeadParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p>
                当前方法页与主图信号视图保持同一策略联动；如需直接回到对应分析页，可前往{' '}
                <Link
                  to={buildMomentumAnalysisPath({ strategyId: strategy.id })}
                  className="font-medium text-[#93C5FD] underline decoration-[rgba(147,197,253,0.45)] underline-offset-4 transition hover:text-white hover:decoration-current"
                >
                  {strategy.label} 动量分析
                </Link>
                。
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <div>
              <div className="text-sm font-semibold text-white">核心结论</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#CBD5E1]">
                {strategy.summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="text-sm font-semibold text-white">{researchHighlights.length ? '研究摘要' : '归档状态'}</div>
              {researchHighlights.length ? (
                <dl className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  {researchHighlights.map((item) => (
                    <div key={item.label} className="border-b border-white/5 pb-2">
                      <dt className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{item.label}</dt>
                      <dd className="mt-1 font-mono text-sm text-[#E6EDF7]">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-3 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-3 text-sm leading-6 text-[#A9B6CC]">
                  当前策略已接入统一方法页架构，但暂未沉淀独立样本回测表，后续可以在同一注册表下继续补充。
                </div>
              )}
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
              <div className="mt-1 text-sm leading-6 text-[#94A3B8]">{strategy.backtestSource}</div>
            </div>
            {strategy.backtestAggregate ? (
              <div className="text-xs text-[#64748B]">
                平均胜率 {fmtNumber(strategy.backtestAggregate.avgWinRatePct, 2, '%')} | 平均持有天数{' '}
                {fmtNumber(strategy.backtestAggregate.avgHoldDays, 2)}
              </div>
            ) : null}
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

          {hasBacktestRows ? (
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
                  {strategy.backtestRows?.map((row) => (
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
          ) : (
            <div className="rounded-lg border border-white/10 bg-[#0B1220] px-4 py-4 text-sm leading-6 text-[#A9B6CC]">
              当前策略暂无正式样本回测表，页面保留了统一的数据口径位置，后续补充研究结果时无需再新增独立页面结构。
            </div>
          )}
        </div>
      </section>
    </PageContentContainer>
  )
}
