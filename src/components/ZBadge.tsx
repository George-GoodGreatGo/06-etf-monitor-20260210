import { cn } from '@/lib/utils'
import { type DataStatus } from '@/utils/etfApi'

function formatZ(z: number) {
  const v = Math.round(z * 100) / 100
  return v.toFixed(2)
}

export default function ZBadge({ z, status }: { z: number | null; status: DataStatus }) {
  if (status !== 'complete') {
    return (
      <span className="rounded-md border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-3 py-1 font-mono text-xs text-[#9CA3AF]">
        {status === 'incomplete' ? '数据不完整' : '拉取失败'}
      </span>
    )
  }

  if (z == null) {
    return (
      <span className="rounded-md border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-3 py-1 font-mono text-xs text-[#9CA3AF]">
        —
      </span>
    )
  }

  const absZ = Math.abs(z)
  const toneClassName =
    absZ >= 2.58
      ? 'border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.22)] text-[#FCA5A5]'
      : absZ >= 1.96
        ? 'border-[rgba(251,191,36,0.28)] bg-[rgba(120,53,15,0.22)] text-[#FCD34D]'
        : absZ >= 1.65
          ? 'border-[rgba(96,165,250,0.28)] bg-[rgba(30,58,138,0.22)] text-[#93C5FD]'
          : 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] text-[#9CA3AF]'

  return (
    <span className={cn('rounded-md border px-3 py-1 font-mono text-xs', toneClassName)}>
      {formatZ(z)}
    </span>
  )
}

