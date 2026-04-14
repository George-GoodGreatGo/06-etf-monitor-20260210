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

export async function getMarketLiquidityV5FromSupabase(args?: { startDate?: string; endDate?: string }) {
  const start8 = typeof args?.startDate === 'string' && args.startDate.trim() ? args.startDate.trim() : ymd8BeijingYearsAgo(10)
  const end8 = typeof args?.endDate === 'string' && args.endDate.trim() ? args.endDate.trim() : ymd8BeijingToday()
  const start10 = normalizeYmd10(start8)
  const end10 = normalizeYmd10(end8)
  if (!start10 || !end10) {
    return { success: false as const, error: 'bad_request', message: 'startDate/endDate 格式错误（需 YYYYMMDD 或 YYYY-MM-DD）' }
  }

  const metaRow = await readMarketBoardMeta()
  const runId = metaRow?.currentRunId || null
  const rows = await readMarketBoardPointsRange({ startDate: start10, endDate: end10, runId })
  if (!rows || rows.length === 0) {
    return {
      success: false as const,
      error: 'no_data',
      message: 'Supabase 尚无大盘看板数据，请等待定时任务或先执行 backfill（近10年）',
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
      notes,
    },
    data: {
      series,
      equityBond: {
        series: equityBondSeries,
      },
    },
  }
}
