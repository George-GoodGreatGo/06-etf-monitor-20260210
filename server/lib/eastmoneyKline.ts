type EastmoneyKlineResp = {
  data?: {
    klines?: string[]
  }
}

export type EastmoneyKlinePoint = {
  date: string
  open: number
  close: number
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function fetchEastmoneyDailyKline(input: {
  secid: string
  beg: string
  end: string
}): Promise<EastmoneyKlinePoint[]> {
  const secid = String(input.secid || '').trim()
  const beg = String(input.beg || '').trim()
  const end = String(input.end || '').trim()
  if (!secid || !beg || !end) return []

  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  url.searchParams.set('secid', secid)
  url.searchParams.set('klt', '101')
  url.searchParams.set('fqt', '1')
  url.searchParams.set('beg', beg)
  url.searchParams.set('end', end)
  url.searchParams.set('fields1', 'f1,f2')
  url.searchParams.set('fields2', 'f51,f52,f53')
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b')

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`eastmoney kline failed: HTTP ${res.status} ${text}`)
  }
  const j = (await res.json().catch(() => null)) as EastmoneyKlineResp | null
  const klines = Array.isArray(j?.data?.klines) ? j?.data?.klines : []

  const out: EastmoneyKlinePoint[] = []
  for (const row of klines) {
    if (typeof row !== 'string') continue
    const parts = row.split(',')
    if (parts.length < 3) continue
    const date = String(parts[0] || '').trim()
    const open = toNum(parts[1])
    const close = toNum(parts[2])
    if (!date || open == null || close == null) continue
    out.push({ date, open, close })
  }
  return out
}

