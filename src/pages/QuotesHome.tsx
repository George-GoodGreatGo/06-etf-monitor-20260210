import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuoteAuthor = 'Warren Buffett' | 'Charlie Munger' | 'Howard Marks'

type Quote = {
  id: string
  author: QuoteAuthor
  zh: string
  en: string
  source: string
  date: string
  tags: Array<'理性' | '耐心' | '冷静' | '周期'>
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(Boolean(mq.matches))
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

function authorLabel(a: QuoteAuthor): string {
  if (a === 'Warren Buffett') return '沃伦·巴菲特'
  if (a === 'Charlie Munger') return '查理·芒格'
  return '霍华德·马克思'
}

function QuoteCarousel({
  quotes,
  intervalMs,
}: {
  quotes: Quote[]
  intervalMs?: number
}) {
  const reducedMotion = usePrefersReducedMotion()
  const interval = typeof intervalMs === 'number' && intervalMs > 2000 ? intervalMs : 7200

  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progressPct, setProgressPct] = useState(0)

  const activeSinceRef = useRef<number>(Date.now())
  const rafRef = useRef<number | null>(null)
  const tickIdRef = useRef<number | null>(null)

  const active = quotes[idx]

  const go = useCallback((nextIdx: number, reason: 'auto' | 'manual') => {
    const total = quotes.length || 1
    const safe = ((nextIdx % total) + total) % total
    setIdx(safe)
    activeSinceRef.current = Date.now()
    setProgressPct(0)
    void reason
  }, [quotes.length])

  useEffect(() => {
    if (!quotes.length) return
    if (reducedMotion || paused) return
    if (tickIdRef.current) window.clearInterval(tickIdRef.current)
    tickIdRef.current = window.setInterval(() => go(idx + 1, 'auto'), interval)
    return () => {
      if (tickIdRef.current) window.clearInterval(tickIdRef.current)
      tickIdRef.current = null
    }
  }, [go, idx, interval, paused, quotes.length, reducedMotion])

  useEffect(() => {
    if (!quotes.length) return
    if (reducedMotion || paused) {
      setProgressPct(0)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return
    }
    const loop = () => {
      const elapsed = Date.now() - activeSinceRef.current
      const pct = Math.max(0, Math.min(1, elapsed / interval))
      setProgressPct(Math.round(pct * 1000) / 10)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [interval, paused, quotes.length, reducedMotion])

  if (!active) return null

  return (
    <section
      className="relative mx-auto w-full max-w-[980px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border border-white/10 bg-[rgba(0,0,0,0.35)] px-5 py-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-[28px] transition-[transform,box-shadow,border-color] duration-300 sm:px-6 sm:py-7',
          reducedMotion ? '' : 'hover:-translate-y-[1px] hover:border-white/15 hover:shadow-[0_50px_140px_rgba(0,0,0,0.6)]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_420px_at_20%_0%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(800px_320px_at_80%_20%,rgba(255,138,80,0.16),transparent_60%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-[#D6DEE9]">
                {authorLabel(active.author)}
              </span>
              <span className="text-xs text-[#94A3B8]">{active.date}</span>
            </div>
            <div className="flex items-center gap-2">
              {active.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#A9B6CC]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div key={active.id} className={cn('mt-5 space-y-4 sm:mt-6 sm:space-y-5', reducedMotion ? '' : 'ui-quote-enter')}>
            <blockquote className="text-balance text-[clamp(18px,2.6vw,30px)] font-semibold leading-[1.3] text-[#F1F5F9]">
              {active.zh}
            </blockquote>
            <div className="text-pretty text-[clamp(12px,1.3vw,16px)] leading-[1.85] text-[#A9B6CC]">
              {active.en}
            </div>
            <div className="text-xs font-medium tracking-wide text-[#64748B] sm:text-sm">{active.source}</div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 sm:mt-7">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn ui-btn-glass h-10 w-10 rounded-full border-white/10 text-[#E6EDF7] hover:border-white/20"
                onClick={() => go(idx - 1, 'manual')}
                aria-label="上一条语录"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-glass h-10 w-10 rounded-full border-white/10 text-[#E6EDF7] hover:border-white/20"
                onClick={() => go(idx + 1, 'manual')}
                aria-label="下一条语录"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {quotes.map((q, i) => {
                const isActive = i === idx
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => go(i, 'manual')}
                    className={cn(
                      'h-2 w-2 rounded-full transition-[transform,opacity,background-color] duration-200',
                      isActive ? 'bg-[#FF8A66] opacity-100 scale-110' : 'bg-white/20 opacity-60 hover:opacity-100',
                    )}
                    aria-label={`切换到第 ${i + 1} 条语录`}
                    aria-current={isActive ? 'true' : undefined}
                  />
                )
              })}
            </div>
          </div>

          <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-white/10 sm:mt-5">
            <div
              className={cn('h-full rounded-full bg-[linear-gradient(90deg,#FFFFFF_0%,#FF8A50_60%,#E65100_100%)]', reducedMotion ? '' : 'transition-[width] duration-150')}
              style={{ width: `${paused || reducedMotion ? 0 : progressPct}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 text-center text-[11px] font-medium tracking-wide text-[#64748B]">
        理性 · 耐心 · 冷静 · 周期
      </div>
    </section>
  )
}

export default function QuotesHome() {
  const nav = useNavigate()
  const [sp] = useSearchParams()

  useEffect(() => {
    const tab = sp.get('tab')
    if (!tab) return
    if (tab !== 'list' && tab !== 'insight' && tab !== 'liquidity' && tab !== 'lowvol') return
    nav({ pathname: '/market', search: `?${sp.toString()}` }, { replace: true })
  }, [nav, sp])

  const quotes = useMemo<Quote[]>(
    () => [
      {
        id: 'buf-001',
        author: 'Warren Buffett',
        zh: '价格是你付出的，价值是你得到的。',
        en: 'Price is what you pay. Value is what you get.',
        source: 'Warren Buffett, Berkshire Hathaway Letter to Shareholders (常见引用)',
        date: '约 2008',
        tags: ['理性'],
      },
      {
        id: 'buf-002',
        author: 'Warren Buffett',
        zh: '别人贪婪时我恐惧，别人恐惧时我贪婪。',
        en: "Be fearful when others are greedy and greedy when others are fearful.",
        source: 'Warren Buffett, Berkshire Hathaway Letter to Shareholders (常见引用)',
        date: '约 1986',
        tags: ['冷静', '周期'],
      },
      {
        id: 'buf-003',
        author: 'Warren Buffett',
        zh: '如果你不打算持有十年，就别想持有十分钟。',
        en: "If you aren't willing to own a stock for ten years, don't even think about owning it for ten minutes.",
        source: 'Warren Buffett (常见引用)',
        date: '约 1996',
        tags: ['耐心'],
      },
      {
        id: 'buf-004',
        author: 'Warren Buffett',
        zh: '第一条规则：永远不要亏钱。第二条规则：永远不要忘记第一条规则。',
        en: 'Rule No.1: Never lose money. Rule No.2: Never forget rule No.1.',
        source: 'Warren Buffett (常见引用)',
        date: '约 1991',
        tags: ['理性', '冷静'],
      },
      {
        id: 'mun-001',
        author: 'Charlie Munger',
        zh: '大钱不在买卖之间，而在等待之中。',
        en: "The big money is not in the buying and selling, but in the waiting.",
        source: 'Charlie Munger (常见引用)',
        date: '约 1990s',
        tags: ['耐心'],
      },
      {
        id: 'mun-002',
        author: 'Charlie Munger',
        zh: '想要得到你想要的东西，先让自己配得上它。',
        en: 'The best way to get what you want is to deserve what you want.',
        source: 'Charlie Munger (常见引用)',
        date: '约 1990s',
        tags: ['理性'],
      },
      {
        id: 'mun-003',
        author: 'Charlie Munger',
        zh: '把你能做对的事情做到极致，避免愚蠢。',
        en: "All I want to know is where I'm going to die so I'll never go there.",
        source: 'Charlie Munger (常见引用)',
        date: '约 2000s',
        tags: ['理性', '冷静'],
      },
      {
        id: 'mun-004',
        author: 'Charlie Munger',
        zh: '投资不需要智商超群，需要的是气质：不跟风、不焦躁。',
        en: 'Investing is not supposed to be easy. Anyone who finds it easy is stupid.',
        source: 'Charlie Munger (常见引用)',
        date: '约 2008',
        tags: ['冷静', '耐心'],
      },
      {
        id: 'hm-001',
        author: 'Howard Marks',
        zh: '你无法预测，但你可以做好准备。',
        en: "You can't predict. You can prepare.",
        source: 'Howard Marks, Oaktree Memo (常见引用)',
        date: '约 2010s',
        tags: ['冷静', '周期'],
      },
      {
        id: 'hm-002',
        author: 'Howard Marks',
        zh: '成功投资更多靠防守：避免致命错误，而不是追求神奇收益。',
        en: "The most important thing is to avoid the big losses.",
        source: 'Howard Marks (常见引用)',
        date: '约 2000s',
        tags: ['理性', '冷静'],
      },
      {
        id: 'hm-003',
        author: 'Howard Marks',
        zh: '周期永远存在，关键在于识别自己身处其中的位置。',
        en: 'Cycles are one of the most important things in the world.',
        source: 'Howard Marks, Mastering the Market Cycle (2018)',
        date: '2018',
        tags: ['周期'],
      },
      {
        id: 'hm-004',
        author: 'Howard Marks',
        zh: '真正的优势来自“二阶思维”：别人看到的你也看到，但你还能多想一步。',
        en: 'Second-level thinking is deep, complex and convoluted.',
        source: 'Howard Marks, The Most Important Thing (2011)',
        date: '2011',
        tags: ['理性'],
      },
    ],
    [],
  )

  return (
    <div className="relative h-[calc(100dvh-72px)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 ui-ambient" aria-hidden="true" />
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] flex-col px-4 py-6 sm:px-8 sm:py-8">
        <header className="mx-auto w-full max-w-[980px] shrink-0 pb-6 pt-2 sm:pb-8 sm:pt-4">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-[#A9B6CC]">
            INVESTMENT MENTAL MODEL
          </div>
          <h1 className="mt-5 text-balance text-[clamp(34px,5vw,64px)] font-black leading-[1.02] tracking-[-0.04em] text-white">
            理性与耐心，
            <br />
            在周期里保持冷静。
          </h1>
          <p className="mt-4 max-w-[56ch] text-pretty text-[clamp(14px,1.5vw,18px)] leading-[1.75] text-[#A9B6CC]">
            这里没有噪音，只有长期有效的原则。读一句，慢一点，再做决定。
          </p>
        </header>

        <div className="flex min-h-0 flex-1 items-center">
          <QuoteCarousel quotes={quotes} />
        </div>
      </div>
    </div>
  )
}
