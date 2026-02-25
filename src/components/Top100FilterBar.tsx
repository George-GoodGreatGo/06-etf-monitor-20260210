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
          className="h-10 w-full rounded-[6px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] pl-9 pr-3 text-sm text-[#E6EDF7] outline-none transition placeholder:text-[#6B7280] focus:border-[rgba(255,87,34,0.45)] focus:shadow-[0_0_0_3px_rgba(255,87,34,0.18)]"
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] px-4 text-sm font-semibold text-[#FF5722] transition hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.06)]"
      >
        <img src="/figma/list/reset_icon.svg" alt="" className="h-4 w-4 select-none" aria-hidden="true" />
        重置
      </button>
    </div>
  )
}
