import type { FilterOption } from '@/utils/top200SignalFilters'

export default function Top100FilterBar({
  keyword,
  onChangeKeyword,
  strategyOptions,
  selectedStrategy,
  onChangeStrategy,
  signalOptions,
  selectedSignal,
  onChangeSignal,
  freshnessOptions,
  selectedFreshness,
  onChangeFreshness,
  zOptions,
  selectedZ,
  onChangeZ,
  onReset,
}: {
  keyword: string
  onChangeKeyword: (v: string) => void
  strategyOptions?: readonly FilterOption[]
  selectedStrategy?: string
  onChangeStrategy?: (v: string) => void
  signalOptions?: readonly FilterOption[]
  selectedSignal?: string
  onChangeSignal?: (v: string) => void
  freshnessOptions?: readonly FilterOption[]
  selectedFreshness?: string
  onChangeFreshness?: (v: string) => void
  zOptions?: readonly FilterOption[]
  selectedZ?: string
  onChangeZ?: (v: string) => void
  onReset: () => void
}) {
  const selectClassName =
    'h-10 rounded-[6px] border border-[#1E293B] bg-[#0F172A] px-3 text-sm text-[#E2E8F0] outline-none transition focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722]'
  return (
    <div className="flex w-full flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {strategyOptions && selectedStrategy != null && onChangeStrategy ? (
          <select value={selectedStrategy} onChange={(e) => onChangeStrategy(e.target.value)} className={selectClassName}>
            {strategyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        {signalOptions && selectedSignal != null && onChangeSignal ? (
          <select value={selectedSignal} onChange={(e) => onChangeSignal(e.target.value)} className={selectClassName}>
            {signalOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        {freshnessOptions && selectedFreshness != null && onChangeFreshness ? (
          <select value={selectedFreshness} onChange={(e) => onChangeFreshness(e.target.value)} className={selectClassName}>
            {freshnessOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        {zOptions && selectedZ != null && onChangeZ ? (
          <select value={selectedZ} onChange={(e) => onChangeZ(e.target.value)} className={selectClassName}>
            {zOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 xl:w-auto">
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
    </div>
  )
}
