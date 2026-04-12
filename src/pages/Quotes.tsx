import QuoteCarousel from '@/components/QuoteCarousel'
import { INVESTOR_QUOTES } from '@/data/investorQuotes'

export default function Quotes() {
  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1040px] items-center">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-6 h-[520px] w-[520px] rounded-full bg-[rgba(255,87,34,0.08)] blur-[120px]" />
        <div className="absolute -right-40 top-24 h-[620px] w-[620px] rounded-full bg-[rgba(14,165,233,0.06)] blur-[140px]" />
        <div className="absolute bottom-[-220px] left-1/3 h-[700px] w-[700px] rounded-full bg-[rgba(255,255,255,0.04)] blur-[160px]" />
      </div>

      <div className="w-full">
        <QuoteCarousel quotes={INVESTOR_QUOTES} autoplayMs={8000} />
      </div>
    </div>
  )
}
