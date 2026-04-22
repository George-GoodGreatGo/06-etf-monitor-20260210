import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

type BreadcrumbItem = {
  label: string
  to?: string
}

export default function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="面包屑" className="flex flex-wrap items-center gap-2 text-sm text-[#94A3B8]">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1
        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.to && !isCurrent ? (
              <Link className="transition hover:text-[#E6EDF7]" to={item.to}>
                {item.label}
              </Link>
            ) : (
              <span className={isCurrent ? 'font-medium text-[#E6EDF7]' : undefined}>{item.label}</span>
            )}
            {!isCurrent ? <ChevronRight className="h-4 w-4 text-[#64748B]" aria-hidden="true" /> : null}
          </div>
        )
      })}
    </nav>
  )
}
