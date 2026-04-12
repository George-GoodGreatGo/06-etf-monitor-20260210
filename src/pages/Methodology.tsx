export default function Methodology() {
  return (
    <div className="mx-auto w-full max-w-[900px]">
        <h1 className="text-lg font-semibold tracking-tight">数据与方法说明</h1>
        <div className="mt-2 text-sm leading-6 text-[#A9B6CC]">
          本站所有数据均通过 API 获取并以真实返回为准；当数据缺失或拉取失败时，会明确提示且不展示任何推测值。
        </div>

        <section className="mt-5 space-y-3 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <h2 className="text-sm font-medium text-[#E6EDF7]">1）仅完整交易日数据</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#A9B6CC]">
            <li>若当前处于 A 股交易时段，仅展示上一完整交易日；绝不展示盘中数据。</li>
            <li>“昨日”指最近一个完整交易日的上一个交易日；如遇非交易日则继续向前追溯。</li>
            <li>当某只 ETF 在目标交易日字段不齐全，将标记为“数据不完整”，对应指标显示“—”。</li>
          </ul>
        </section>

        <section className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <h2 className="text-sm font-medium text-[#E6EDF7]">2）Top100 列表口径</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#A9B6CC]">
            <li>默认展示成交额 Top100（从高到低）。</li>
            <li>列表支持按代码/名称查找，支持按关键字段排序（升/降序）。</li>
            <li>缺失/失败条目不会参与基于该字段的排序与“异常标记”。</li>
          </ul>
        </section>

        <section className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <h2 className="text-sm font-medium text-[#E6EDF7]">3）90 天成交额 Z 值</h2>
          <div className="text-sm text-[#A9B6CC]">
            Z 值定义：
            <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-[#E6EDF7]">
              Z = (本交易日成交额 − 最近90个交易日成交额均值) / 最近90个交易日成交额标准差
            </div>
            <div className="mt-2 text-xs text-[#A9B6CC]">
              |Z| 越大，代表相对历史波动越异常。本站对 |Z|≥1.65 / 1.96 / 2.58 的条目进行分级标记。
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <h2 className="text-sm font-medium text-[#E6EDF7]">4）免责声明</h2>
          <div className="text-sm text-[#A9B6CC]">
            本站仅提供信息展示与数据工具，不构成任何投资建议。
          </div>
        </section>
    </div>
  )
}
