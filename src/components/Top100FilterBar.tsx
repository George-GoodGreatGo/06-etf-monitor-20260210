import { cn } from '@/lib/utils'
import type { FilterOption } from '@/utils/top200SignalFilters'

function TagGroup({
  options,
  selected,
  onChange,
  label,
}: {
  options: readonly FilterOption[]
  selected: readonly string[]
  onChange: (v: string[]) => void
  label: string
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-[#94A3B8]">{label}</span>
      {options.map((opt) => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition',
              active
                ? 'border-[#FF5722] bg-[rgba(255,87,34,0.15)] text-white'
                : 'border-white/10 bg-white/5 text-[#94A3B8] hover:border-white/20 hover:text-[#E2E8F0]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

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
  selectedSignal?: readonly string[]
  onChangeSignal?: (v: string[]) => void
  freshnessOptions?: readonly FilterOption[]
  selectedFreshness?: readonly string[]
  onChangeFreshness?: (v: string[]) => void
  zOptions?: readonly FilterOption[]
  selectedZ?: readonly string[]
  onChangeZ?: (v: string[]) => void
  onReset: () => void
}) {
  const selectClassName =
    'h-10 rounded-[6px] border border-[#1E293B] bg-[#0F172A] px-3 text-sm text-[#E2E8F0] outline-none transition focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722]'
  const hasAnyFilter =
    (selectedSignal && selectedSignal.length > 0) ||
    (selectedFreshness && selectedFreshness.length > 0) ||
    (selectedZ && selectedZ.length > 0)

  return (
    <div className="flex w-full flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {strategyOptions && selectedStrategy != null && onChangeStrategy ? (
            <select value={selectedStrategy} onChange={(e) => onChangeStrategy(e.target.value)} className={selectClassName}>
              {strategyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {signalOptions && selectedSignal != null && onChangeSignal ? (
            <TagGroup
              options={signalOptions}
              selected={selectedSignal}
              onChange={onChangeSignal}
              label="信号"
            />
          ) : null}
          {freshnessOptions && selectedFreshness != null && onChangeFreshness ? (
            <TagGroup
              options={freshnessOptions}
              selected={selectedFreshness}
              onChange={onChangeFreshness}
              label="新鲜度"
            />
          ) : null}
          {zOptions && selectedZ != null && onChangeZ ? (
            <TagGroup
              options={zOptions}
              selected={selectedZ}
              onChange={onChangeZ}
              label="Z值"
            />
          ) : null}
        </div>
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
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border px-4 text-sm font-medium transition',
            hasAnyFilter
              ? 'border-[#FF5722] bg-[#FF5722] text-white hover:brightness-110'
              : 'border-[#1E293B] bg-[#0F172A] text-[#FF5722] hover:border-[#334155] hover:bg-[#1E293B]',
          )}
        >
          <img src="/figma/list/reset_icon.svg" alt="" className="h-4 w-4 select-none" aria-hidden="true" />
          重置
        </button>
      </div>
    </div>
  )
}
