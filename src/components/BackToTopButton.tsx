import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BackToTopButton({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      setVisible(window.scrollY >= 600)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={cn(
        'fixed bottom-6 right-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[rgba(0,0,0,0.55)] text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur transition-all duration-200 hover:-translate-y-[1px] hover:border-white/20 hover:bg-[rgba(255,255,255,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/50',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0 translate-y-2',
        className,
      )}
      aria-label="返回顶部"
      title="返回顶部"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  )
}

