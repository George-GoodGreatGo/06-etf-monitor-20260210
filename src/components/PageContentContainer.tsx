import type { ReactNode } from 'react'

type PageContentContainerProps = {
  children: ReactNode
  className?: string
}

export default function PageContentContainer({ children, className }: PageContentContainerProps) {
  return <div className={['mx-auto w-full max-w-[1280px] space-y-4', className].filter(Boolean).join(' ')}>{children}</div>
}
