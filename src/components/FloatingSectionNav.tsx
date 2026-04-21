import { useEffect, useMemo, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FloatingNavSection = {
  id: string
  label: string
  shortLabel?: string
}

type FloatingSectionNavProps = {
  sections?: FloatingNavSection[]
  className?: string
  offsetTop?: number
  visibleScrollY?: number
}

function scrollToY(top: number) {
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

export default function FloatingSectionNav({
  sections = [],
  className,
  offsetTop = 96,
  visibleScrollY = 600,
}: FloatingSectionNavProps) {
  const [visible, setVisible] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const normalizedSections = useMemo(
    () => sections.filter((section) => section.id.trim() && section.label.trim()),
    [sections],
  )
  const hasSections = normalizedSections.length > 0

  useEffect(() => {
    if (typeof window === 'undefined') return

    const resolveActiveSection = () => {
      if (!normalizedSections.length) {
        setActiveSectionId(null)
        return
      }

      const markerY = offsetTop + 24
      let currentId: string | null = null
      let nearestUpcoming: { id: string; top: number } | null = null

      for (const section of normalizedSections) {
        const element = document.getElementById(section.id)
        if (!element) continue
        const top = element.getBoundingClientRect().top

        if (top <= markerY) currentId = section.id
        if (top > markerY && (!nearestUpcoming || top < nearestUpcoming.top)) {
          nearestUpcoming = { id: section.id, top }
        }
      }

      setActiveSectionId(currentId ?? nearestUpcoming?.id ?? null)
    }

    const onScroll = () => {
      setScrolled(window.scrollY > 0)
      setVisible(hasSections || window.scrollY >= visibleScrollY)
      resolveActiveSection()
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [hasSections, normalizedSections, offsetTop, visibleScrollY])

  if (!hasSections) {
    return (
      <button
        type="button"
        onClick={() => scrollToY(0)}
        className={cn(
          'fixed bottom-6 right-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[rgba(0,0,0,0.55)] text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-[rgba(255,255,255,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50',
          visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
          className,
        )}
        aria-label="返回顶部"
        title="返回顶部"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    )
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (!element) return
    const top = window.scrollY + element.getBoundingClientRect().top - offsetTop
    scrollToY(top)
  }

  return (
    <div
      className={cn(
        'fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2 rounded-2xl border border-white/10 bg-[rgba(5,10,11,0.82)] p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-200 sm:right-6',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
      aria-label="页面模块导航"
    >
      <div className="px-2 pt-1 text-center text-[10px] font-semibold tracking-wide text-[#94A3B8]">模块导航</div>
      <div className="flex flex-col gap-1">
        {normalizedSections.map((section, index) => {
          const active = activeSectionId === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={cn(
                'group flex min-w-[72px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
                active
                  ? 'border-[rgba(255,87,34,0.55)] bg-[rgba(255,87,34,0.14)] text-white shadow-[0_0_0_1px_rgba(255,87,34,0.16)]'
                  : 'border-white/8 bg-white/[0.04] text-[#A9B6CC] hover:border-white/15 hover:bg-white/8 hover:text-white',
              )}
              aria-current={active ? 'true' : undefined}
              title={section.label}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  active
                    ? 'border-[rgba(255,138,102,0.55)] bg-[rgba(255,87,34,0.18)] text-[#FFD6C8]'
                    : 'border-white/10 bg-white/5 text-[#94A3B8] group-hover:text-white',
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="leading-tight">
                <span className="hidden sm:inline">{section.label}</span>
                <span className="sm:hidden">{section.shortLabel || index + 1}</span>
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => scrollToY(0)}
        className={cn(
          'mt-1 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A66]/35 focus-visible:ring-offset-0',
          scrolled
            ? 'border-white/10 bg-white/5 text-[#E6EDF7] hover:border-white/20 hover:bg-white/10'
            : 'border-white/8 bg-white/[0.03] text-[#64748B]',
        )}
        title="返回顶部"
      >
        <ArrowUp className="h-4 w-4" />
        <span className="hidden sm:inline">返回顶部</span>
      </button>
    </div>
  )
}
