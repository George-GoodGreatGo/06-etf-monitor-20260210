import QuoteCarousel from '@/components/QuoteCarousel'
import { INVESTOR_QUOTES } from '@/data/investorQuotes'

export default function Quotes() {
  return (
    <div className="relative mx-auto w-full max-w-[980px]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-[420px] w-[420px] rounded-full bg-[rgba(255,87,34,0.10)] blur-[90px]" />
        <div className="absolute -right-10 top-40 h-[520px] w-[520px] rounded-full bg-[rgba(14,165,233,0.08)] blur-[110px]" />
        <div className="absolute bottom-[-140px] left-1/3 h-[520px] w-[520px] rounded-full bg-[rgba(255,255,255,0.05)] blur-[120px]" />
      </div>

      <div className="mb-6">
        <div className="text-[12px] font-semibold tracking-wide text-[#94A3B8]">语录首页</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">理性与耐心</h1>
        <div className="mt-2 text-sm leading-6 text-[#A9B6CC]">
          让正确的原则在关键时刻帮你做决定：保持耐心，远离情绪，尊重周期。
        </div>
      </div>

      <QuoteCarousel quotes={INVESTOR_QUOTES} autoplayMs={8000} />
    </div>
  )
}

