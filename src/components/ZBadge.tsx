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

  return (
    <span className="rounded-md border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-3 py-1 font-mono text-xs text-[#9CA3AF]">
      {z == null ? '—' : formatZ(z)}
    </span>
  )
}

