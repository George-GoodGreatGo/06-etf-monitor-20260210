import QuoteCarousel from '@/components/QuoteCarousel'
import { QUOTES } from '@/data/quotes'

export default function QuoteHome() {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-8 grid gap-10 lg:grid-cols-[420px_1fr] lg:items-start">
        <div>
          <div className="text-xs font-semibold tracking-wide text-[#94A3B8]">Home</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">投资备忘录</h1>
          <div className="mt-3 text-sm leading-7 text-[#94A3B8]">
            让决策先回到原则：风险、概率、边界与耐心。不是每一次波动都需要回应。
          </div>

          <div className="mt-7 space-y-2 text-sm text-[#A9B6CC]">
            <div className="flex items-start gap-3">
              <div className="mt-2 h-1.5 w-1.5 rounded-full bg-white/25" aria-hidden="true" />
              <div>先谈风险，再谈收益。</div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-2 h-1.5 w-1.5 rounded-full bg-white/25" aria-hidden="true" />
              <div>优先避免大错，其它交给时间。</div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-2 h-1.5 w-1.5 rounded-full bg-white/25" aria-hidden="true" />
              <div>不做无把握的交易，允许空仓与等待。</div>
            </div>
          </div>
        </div>

        <QuoteCarousel items={QUOTES} />
      </div>

      <div className="mt-8 text-xs leading-6 text-[#94A3B8]">
        语录用于自我提醒，不构成投资建议。出处字段为公开材料的常见引用描述；如需更严格溯源，可继续补充校对。
      </div>
    </div>
  )
}

