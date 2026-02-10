import { Search, RotateCcw } from 'lucide-react'

export default function Top100FilterBar({
  keyword,
  onChangeKeyword,
  onReset,
}: {
  keyword: string
  onChangeKeyword: (v: string) => void
  onReset: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
      <div className="relative w-full md:w-[320px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A9B6CC]" />
        <input
          value={keyword}
          onChange={(e) => onChangeKeyword(e.target.value)}
          placeholder="代码/名称"
          className="h-10 w-full rounded-lg border border-white/10 bg-[#111B2E] pl-9 pr-3 text-sm outline-none transition focus:border-white/20"
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#111B2E] px-3 text-sm text-[#E6EDF7] transition hover:border-white/20 hover:bg-white/5"
      >
        <RotateCcw className="h-4 w-4" />
        重置
      </button>
    </div>
  )
}

