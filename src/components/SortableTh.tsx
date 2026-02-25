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
    <ChevronsUpDown className="h-4 w-4" />
  ) : dir === 'asc' ? (
    <ArrowUp className="h-4 w-4" />
  ) : (
    <ArrowDown className="h-4 w-4" />
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
          'inline-flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-[rgba(255,255,255,0.06)]',
          align === 'right' && 'ml-auto',
          active && 'text-[#E6EDF7]',
        )}
      >
        {children}
        <span className={cn('text-[#94A3B8]', active && 'text-[#E6EDF7]')}>
          {icon}
        </span>
      </button>
    </th>
  )
}

