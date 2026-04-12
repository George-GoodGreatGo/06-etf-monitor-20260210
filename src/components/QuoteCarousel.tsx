import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuoteItem } from '@/data/quotes'

export default function QuoteCarousel({ items }: { items: QuoteItem[] }) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items.filter(Boolean) : []), [items])
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [entered, setEntered] = useState(false)
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
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    if (reduce) {
      setEntered(true)
      return
    }
    setEntered(false)
    const raf = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(raf)
  }, [current?.id, safeItems.length])

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
    <section className="relative group">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(7,12,14,0.55)] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-[18px] sm:p-10">
        <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-[rgba(255,255,255,0.08)] blur-[90px]" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-56 w-56 rounded-full bg-[rgba(255,87,34,0.14)] blur-[90px]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)', backgroundSize: '18px 18px' }} />

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs font-semibold tracking-wide text-[#94A3B8]">Quotes</div>
          <div className="flex items-center gap-2 opacity-90 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => goto(idx - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/0 text-white transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/40"
              aria-label="上一条"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/0 px-4 text-xs font-semibold text-white transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/40"
              aria-label={paused ? '播放' : '暂停'}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? '播放' : '暂停'}
            </button>
            <button
              type="button"
              onClick={() => goto(idx + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/0 text-white transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/40"
              aria-label="下一条"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            'mt-8 space-y-6 transition-all duration-200 ease-out will-change-transform',
            entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          <div className="text-[26px] font-semibold leading-[1.28] tracking-tight text-white sm:text-[34px]">
            {current?.quoteZh}
          </div>
          <div className="text-sm leading-7 text-[#9AA8BF] sm:text-base">
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
                  active ? 'w-7 bg-[#FF5722]' : 'w-2.5 bg-white/10 hover:bg-white/20',
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

