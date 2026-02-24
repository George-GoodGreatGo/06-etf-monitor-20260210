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
          className="ui-input h-10 w-full pl-9 pr-3 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="ui-btn ui-btn-outline h-10 px-3 text-sm"
      >
        <RotateCcw className="h-4 w-4" />
        重置
      </button>
    </div>
  )
}
