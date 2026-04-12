import QuoteCarousel from '@/components/QuoteCarousel'
import { QUOTES } from '@/data/quotes'

export default function QuoteHome() {
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">投资之前，先把心态摆正</h1>
        <div className="mt-2 text-sm leading-7 text-[#94A3B8]">
          用理性与耐心对抗噪声。用风险意识保护复利。让决策从“正确的原则”开始，而不是从“短期的情绪”开始。
        </div>
      </div>

      <QuoteCarousel items={QUOTES} />

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { title: '理性', desc: '先定义风险与边界，再讨论收益与机会。' },
          { title: '耐心', desc: '等待高胜率时刻，而不是每天都要做决定。' },
          { title: '纪律', desc: '遵守流程与原则，避免“当下情绪”主导操作。' },
        ].map((x) => (
          <div
            key={x.title}
            className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)] backdrop-blur"
          >
            <div className="text-sm font-semibold text-white">{x.title}</div>
            <div className="mt-2 text-sm leading-6 text-[#A9B6CC]">{x.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

