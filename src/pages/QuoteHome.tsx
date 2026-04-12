import QuoteCarousel from '@/components/QuoteCarousel'
import { QUOTES } from '@/data/quotes'

export default function QuoteHome() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] items-center justify-center py-6 sm:py-10">
      <div className="w-full">
        <QuoteCarousel items={QUOTES} />
      </div>
    </div>
  )
}

