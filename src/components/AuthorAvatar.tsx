import { cn } from '@/lib/utils'
import type { QuoteAuthor } from '@/data/quotes'

export default function AuthorAvatar({
  author,
  text,
  className,
}: {
  author: QuoteAuthor
  text: string
  className?: string
}) {
  const tone =
    author === 'Warren Buffett'
      ? 'from-[rgba(255,255,255,0.18)] to-[rgba(255,87,34,0.10)]'
      : author === 'Charlie Munger'
        ? 'from-[rgba(255,255,255,0.18)] to-[rgba(148,163,184,0.10)]'
        : 'from-[rgba(255,255,255,0.18)] to-[rgba(255,193,7,0.10)]'

  return (
    <div
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br text-xs font-semibold tracking-wide text-[#E6EDF7] shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur',
        tone,
        className,
      )}
      aria-hidden="true"
    >
      {text}
    </div>
  )
}

