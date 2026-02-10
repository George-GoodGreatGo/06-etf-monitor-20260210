import { AlertCircle, Flame, Siren } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type DataStatus } from '@/utils/etfApi'

function formatZ(z: number) {
  const v = Math.round(z * 100) / 100
  return v.toFixed(2)
}

export default function ZBadge({ z, status }: { z: number | null; status: DataStatus }) {
  if (status !== 'complete') {
    return (
      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-[#A9B6CC]">
        {status === 'incomplete' ? '数据不完整' : '拉取失败'}
      </span>
    )
  }

  if (z == null) {
    return (
      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-[#A9B6CC]">
        —
      </span>
    )
  }

  const abs = Math.abs(z)
  const level =
    abs >= 2.58 ? 'extreme' : abs >= 1.96 ? 'high' : abs >= 1.65 ? 'mid' : 'low'

  const theme =
    level === 'extreme'
      ? {
          cls: 'border-[#A855F7]/40 bg-[#A855F7]/10 text-[#E6EDF7]',
          icon: <Siren className="h-4 w-4" />,
          label: '|Z|≥2.58',
        }
      : level === 'high'
        ? {
            cls: 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#E6EDF7]',
            icon: <Flame className="h-4 w-4" />,
            label: '|Z|≥1.96',
          }
        : level === 'mid'
          ? {
              cls: 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#E6EDF7]',
              icon: <AlertCircle className="h-4 w-4" />,
              label: '|Z|≥1.65',
            }
          : {
              cls: 'border-white/10 bg-white/5 text-[#E6EDF7]',
              icon: null,
              label: null,
            }

  return (
    <span
      title={theme.label ?? undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs',
        theme.cls,
      )}
    >
      {theme.icon}
      {formatZ(z)}
    </span>
  )
}

