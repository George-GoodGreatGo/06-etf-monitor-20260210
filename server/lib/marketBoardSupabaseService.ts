import { readMarketBoardMeta, readMarketBoardPointsRange } from './supabaseRest.js'

function ymd8ToYmd10(ymd8: string): string {
  const s = String(ymd8 || '').trim()
  if (!/^\d{8}$/.test(s)) return ''
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function normalizeYmd10(s: string): string {
  const t = String(s || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  if (/^\d{8}$/.test(t)) return ymd8ToYmd10(t)
  return ''
}

function ymd10ToUtcMs(ymd10: string): number | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const ms = Date.UTC(y, m - 1, d)
  return Number.isFinite(ms) ? ms : null
}

function diffDaysUtc(aYmd10: string, bYmd10: string): number | null {
  const a = ymd10ToUtcMs(aYmd10)
  const b = ymd10ToUtcMs(bYmd10)
  if (a == null || b == null) return null
  return Math.floor((a - b) / 86_400_000)
}

function ymd8BeijingToday(): string {
  const d = new Date(Date.now() + 8 * 3600_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function ymd8BeijingYearsAgo(years: number): string {
  const d = new Date(Date.now() + 8 * 3600_000)
  d.setUTCFullYear(d.getUTCFullYear() - years)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

type LiquidityPoint = {
  date: string
  close: number
  amount: number | null
  tr: number | null
  northMoney: number | null
  amountPct: number | null
  trPct: number | null
  northPct: number | null
  v5: number | null
  v5Pct: number | null
}

type EquityBondPoint = {
  date: string
  pe: number | null
  earningsYield: number | null
  yield10yPct: number | null
  value: number | null
  pct: number | null
}

function validateRows(rows: Array<{ data_date: string; close: number | null }>): { ok: true } | { ok: false; error: string; message: string } {
  if (!rows || rows.length === 0) return { ok: false, error: 'no_data', message: 'Supabase 返回空序列' }
  const seen = new Set<string>()
  let prev = ''
  let dup = 0
  let nonInc = 0
  let closeOk = 0
  for (const r of rows) {
    const d = typeof r.data_date === 'string' ? r.data_date : ''
    if (!d) continue
    if (seen.has(d)) dup += 1
    seen.add(d)
    if (prev && d <= prev) nonInc += 1
    prev = d
    const c = typeof r.close === 'number' ? r.close : null
    if (c != null && Number.isFinite(c)) closeOk += 1
  }
  if (closeOk === 0) return { ok: false, error: 'no_valid_points', message: '关键序列（close）无有效点' }
  if (dup > 0 || nonInc > 0) {
    return { ok: false, error: 'bad_date_series', message: `日期序列异常（dup=${dup}, nonInc=${nonInc}）` }
  }
  return { ok: true }
}

export async function getMarketLiquidityV5FromSupabase(args?: { startDate?: string; endDate?: string }) {
  const start8 = typeof args?.startDate === 'string' && args.startDate.trim() ? args.startDate.trim() : ymd8BeijingYearsAgo(10)
  const end8 = typeof args?.endDate === 'string' && args.endDate.trim() ? args.endDate.trim() : ymd8BeijingToday()
  const start10 = normalizeYmd10(start8)
  const end10 = normalizeYmd10(end8)
  if (!start10 || !end10) {
    return { success: false as const, error: 'bad_request', message: 'startDate/endDate 格式错误（需 YYYYMMDD 或 YYYY-MM-DD）' }
  }

  const metaRow = await readMarketBoardMeta()
  const candidates = [metaRow?.currentRunId || null, metaRow?.previousRunId || null].filter(Boolean) as string[]
  if (candidates.length === 0) {
    return { success: false as const, error: 'no_data', message: 'Supabase 尚无大盘看板数据（meta 未初始化）' }
  }

  let rows: any[] = []
  let usedRunId: string | null = null
  let fallbackReason: string | null = null
  for (const rid of candidates) {
    const r = await readMarketBoardPointsRange({ startDate: start10, endDate: end10, runId: rid })
    if (!r || r.length === 0) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${rid}:empty` : `run=${rid}:empty`
      continue
    }
    const last = r[r.length - 1]
    const lastDate = typeof last?.data_date === 'string' ? last.data_date : ''
    const lag = lastDate ? diffDaysUtc(end10, lastDate) : null
    if (lag != null && lag > 14) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${rid}:stale(${lag}d)` : `run=${rid}:stale(${lag}d)`
      continue
    }
    const v = validateRows(r as Array<{ data_date: string; close: number | null }>)
    if (!v.ok) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${rid}:${v.error}` : `run=${rid}:${v.error}`
      continue
    }
    rows = r
    usedRunId = rid
    break
  }

  if (!rows || rows.length === 0) {
    return {
      success: false as const,
      error: 'no_data',
      message: 'Supabase 尚无可用大盘看板数据（current/previous 均不可用）',
    }
  }

  const series: LiquidityPoint[] = rows.map((r) => ({
    date: r.data_date,
    close: r.close,
    amount: r.amount ?? null,
    tr: r.tr ?? null,
    northMoney: r.north_money ?? null,
    amountPct: r.amount_pct ?? null,
    trPct: r.tr_pct ?? null,
    northPct: r.north_pct ?? null,
    v5: r.v5 ?? null,
    v5Pct: r.v5_pct ?? null,
  }))

  const equityBondSeries: EquityBondPoint[] = rows.map((r) => ({
    date: r.data_date,
    pe: r.pe ?? null,
    earningsYield: r.earnings_yield ?? null,
    yield10yPct: r.yield10y_pct ?? null,
    value: r.equity_bond_value ?? null,
    pct: r.equity_bond_pct ?? null,
  }))

  const last = rows[rows.length - 1]
  const notes = Array.isArray(last.notes) ? (last.notes as unknown[]) : null

  return {
    success: true as const,
    meta: {
      fetchedAt: last.fetched_at ?? null,
      dataDate: last.data_date ?? null,
      sourceType: 'supabase-table',
      source: 'supabase:market_board_point',
      notes: [
        ...(notes || []),
        ...(usedRunId ? [`run_id=${usedRunId}`] : []),
        ...(fallbackReason ? [`run_fallback=${fallbackReason}`] : []),
      ],
    },
    data: {
      series,
      equityBond: {
        series: equityBondSeries,
      },
    },
  }
}
