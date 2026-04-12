import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InvestorQuote } from '@/data/investorQuotes'

export default function QuoteCarousel({
  quotes,
  autoplayMs = 8000,
  className,
}: {
  quotes: InvestorQuote[]
  autoplayMs?: number
  className?: string
}) {
  const safeQuotes = useMemo(() => quotes.filter(Boolean), [quotes])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [present, setPresent] = useState(true)
  const pendingRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const count = safeQuotes.length
  const current = count ? safeQuotes[index % count] : null

  const commitIndex = (next: number) => {
    if (!count) return
    const normalized = ((next % count) + count) % count
    pendingRef.current = normalized
    setPresent(false)
  }

  useEffect(() => {
    if (!count) return
    if (present) return
    const t = window.setTimeout(() => {
      if (pendingRef.current == null) return
      setIndex(pendingRef.current)
      pendingRef.current = null
      setPresent(false)
      window.requestAnimationFrame(() => setPresent(true))
    }, 180)
    return () => window.clearTimeout(t)
  }, [count, present])

  useEffect(() => {
    if (!count) return
    if (paused) return
    const id = window.setInterval(() => {
      commitIndex(index + 1)
    }, autoplayMs)
    return () => window.clearInterval(id)
  }, [autoplayMs, count, index, paused])

  useEffect(() => {
    setIndex(0)
    setPresent(true)
    pendingRef.current = null
  }, [count])

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => {
        window.requestAnimationFrame(() => {
          const root = rootRef.current
          if (!root) return
          const active = document.activeElement
          if (active && root.contains(active)) return
          setPaused(false)
        })
      }}
    >
      <div className={cn('ui-glass-card px-6 py-7 sm:px-10 sm:py-10', 'transition-all duration-200')}>
        <div
          className={cn(
            'transition-[opacity,transform,filter] duration-200 ease-out',
            present ? 'opacity-100 translate-y-0 scale-100 blur-0' : 'opacity-0 translate-y-2 scale-[0.985] blur-[1px]',
          )}
        >
          {current ? (
            <>
              <div className="text-[11px] font-semibold tracking-wide text-[#94A3B8]">{current.author}</div>
              <div className="mt-3 text-balance text-[28px] font-semibold leading-[1.18] tracking-tight text-white sm:text-[40px]">
                {current.quoteZh}
              </div>
              <div className="mt-4 text-balance text-[14px] leading-7 text-[#C7D2E5] sm:text-[16px]">
                {current.quoteEn}
              </div>
              <div className="mt-6 text-xs text-[#94A3B8]">
                出处：<span className="text-[#A9B6CC]">{current.source}</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#A9B6CC]">暂无语录</div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => commitIndex(index - 1)}
            disabled={!count}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-transparent text-white/90 transition hover:border-white/20 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="上一条"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            {new Array(count).fill(0).map((_, i) => {
              const active = i === index
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => commitIndex(i)}
                  className={cn(
                    'h-2 w-2 rounded-full transition-all duration-200',
                    active ? 'bg-[#FF5722] shadow-[0_0_0_3px_rgba(255,87,34,0.16)]' : 'bg-white/14 hover:bg-white/22',
                  )}
                  aria-label={`切换到第 ${i + 1} 条`}
                />
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => commitIndex(index + 1)}
            disabled={!count}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-transparent text-white/90 transition hover:border-white/20 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="下一条"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
