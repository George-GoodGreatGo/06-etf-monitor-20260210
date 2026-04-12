import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuoteItem } from '@/data/quotes'

export default function QuoteCarousel({ items }: { items: QuoteItem[] }) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items.filter(Boolean) : []), [items])
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const current = safeItems.length ? safeItems[(idx + safeItems.length) % safeItems.length] : null

  const goto = (n: number) => {
    if (!safeItems.length) return
    setIdx((prev) => {
      const next = n % safeItems.length
      return next < 0 ? next + safeItems.length : next
    })
  }

  useEffect(() => {
    if (!safeItems.length) return
    if (paused) return
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    if (reduce) return
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(() => goto(idx + 1), 8000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, idx, safeItems.length])

  if (!safeItems.length) return null

  return (
    <section className="relative">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(13,26,28,0.72)] p-8 shadow-[0_0_60px_-20px_rgba(255,87,34,0.30)] backdrop-blur-[18px] sm:p-10">
        <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-[rgba(255,87,34,0.25)] blur-[90px]" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-56 w-56 rounded-full bg-[rgba(255,255,255,0.08)] blur-[90px]" />

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs font-semibold tracking-wide text-[#94A3B8]">理性与耐心</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goto(idx - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50"
              aria-label="上一条"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50"
              aria-label={paused ? '播放' : '暂停'}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? '播放' : '暂停'}
            </button>
            <button
              type="button"
              onClick={() => goto(idx + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50"
              aria-label="下一条"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div key={current?.id} className="mt-8 space-y-6 transition-all duration-300 ease-out will-change-transform">
          <div className="text-[26px] font-semibold leading-[1.28] tracking-tight text-white sm:text-[34px]">
            {current?.quoteZh}
          </div>
          <div className="text-sm leading-7 text-[#A9B6CC] sm:text-base">
            {current?.quoteEn}
          </div>

          <div className="flex flex-col gap-1 pt-2 text-xs text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between">
            <div className="font-semibold text-[#E6EDF7]">{current?.author}</div>
            <div className="sm:text-right">{current?.source}</div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          {safeItems.map((it, i) => {
            const active = i === ((idx % safeItems.length) + safeItems.length) % safeItems.length
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => goto(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all duration-200',
                  active ? 'w-8 bg-[#FF5722]' : 'w-2.5 bg-white/15 hover:bg-white/25',
                )}
                aria-label={`第 ${i + 1} 条`}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

