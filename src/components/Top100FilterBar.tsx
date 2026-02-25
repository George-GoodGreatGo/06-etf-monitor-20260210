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
        <img
          src="/figma/list/search_icon.svg"
          alt=""
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 select-none"
          aria-hidden="true"
        />
        <input
          value={keyword}
          onChange={(e) => onChangeKeyword(e.target.value)}
          placeholder="代码/名称"
          className="ui-input h-10 w-full pl-3 pr-9 text-sm placeholder:text-[#64748B]"
        />
      </div>
      <button
        type="button"
        onClick={onReset}
        className="ui-btn ui-btn-glass h-10 px-3 text-sm text-[#FF8A50]"
      >
        <img src="/figma/list/reset_icon.svg" alt="" className="h-4 w-4 select-none" aria-hidden="true" />
        重置
      </button>
    </div>
  )
}
