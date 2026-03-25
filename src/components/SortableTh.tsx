import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'

export default function SortableTh({
  children,
  active,
  dir,
  onClick,
  align,
  className,
}: {
  children: React.ReactNode
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'left' | 'right'
  className?: string
}) {
  const icon = !active ? (
    <ChevronsUpDown className="h-[14px] w-[14px]" />
  ) : dir === 'asc' ? (
    <ArrowUp className="h-[14px] w-[14px]" />
  ) : (
    <ArrowDown className="h-[14px] w-[14px]" />
  )

  return (
    <th
      className={cn(
        'select-none px-4 py-3',
        align === 'right' && 'text-right',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group inline-flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-white/5',
          align === 'right' && 'ml-auto flex-row-reverse',
          active && 'text-[#E2E8F0]',
        )}
      >
        {children}
        <span
          className={cn(
            'text-[#475569] opacity-0 transition-opacity group-hover:opacity-100',
            active && 'text-[#94A3B8] opacity-100',
          )}
        >
          {icon}
        </span>
      </button>
    </th>
  )
}

