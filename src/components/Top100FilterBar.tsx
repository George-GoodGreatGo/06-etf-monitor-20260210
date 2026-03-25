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
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
      <div className="relative w-full sm:w-[240px]">
        <img
          src="/figma/list/search_icon.svg"
          alt=""
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 select-none"
          aria-hidden="true"
        />
        <input
          value={keyword}
          onChange={(e) => onChangeKeyword(e.target.value)}
          placeholder="代码/名称"
          className="h-10 w-full rounded-[6px] border border-[#1E293B] bg-[#0F172A] pl-9 pr-3 text-sm text-[#E2E8F0] outline-none transition placeholder:text-[#64748B] focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722]"
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#1E293B] bg-[#0F172A] px-4 text-sm font-medium text-[#FF5722] transition hover:border-[#334155] hover:bg-[#1E293B]"
      >
        <img src="/figma/list/reset_icon.svg" alt="" className="h-4 w-4 select-none" aria-hidden="true" />
        重置
      </button>
    </div>
  )
}
