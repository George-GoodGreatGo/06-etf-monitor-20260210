import * as XLSX from 'xlsx'

import {
  createPoint,
  fetchBufferWithRetry,
  normalizeYmd10,
  toNum,
  type Riskfree10yProviderResult,
  type Riskfree10yRawPoint,
} from './shared.js'

const YC_DEF_ID_GOV_BOND_MATURITY = '2c9081e50a2f9606010a3068cae70001'

const cache = new Map<number, { expiresAt: number; value: Map<string, Riskfree10yRawPoint> }>()
const inflight = new Map<number, Promise<Map<string, Riskfree10yRawPoint>>>()

function toYmd10FromExcelDate(n: number): string | null {
  const v = XLSX.SSF.parse_date_code(n)
  if (!v) return null
  const y = String(v.y).padStart(4, '0')
  const m = String(v.m).padStart(2, '0')
  const d = String(v.d).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeExcelYmd10(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return toYmd10FromExcelDate(raw) || ''
  return normalizeYmd10(raw)
}

function findHeaderRow(rows: unknown[][]): { rowIdx: number; dateCol: number; termCol: number; yieldCol: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i] || []
    let dateCol = -1
    let termCol = -1
    let yieldCol = -1
    for (let c = 0; c < row.length; c += 1) {
      const s = typeof row[c] === 'string' ? String(row[c]).replace(/\s+/g, '') : ''
      if (dateCol < 0 && s === '日期') dateCol = c
      if (termCol < 0 && (s === '标准期限(年)' || s === '标准期限（年）')) termCol = c
      if (yieldCol < 0 && (s === '收益率(%)' || s === '收益率（%）')) yieldCol = c
    }
    if (dateCol >= 0 && termCol >= 0 && yieldCol >= 0) return { rowIdx: i, dateCol, termCol, yieldCol }
  }
  return null
}

async function fetchYear(year: number): Promise<Map<string, Riskfree10yRawPoint>> {
  const hit = cache.get(year)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const existing = inflight.get(year)
  if (existing) return await existing

  const task = (async () => {
    const url =
      `https://yield.chinabond.com.cn/cbweb-mn/yc/downYearBzqx?year=${year}` +
      `&wrjxCBFlag=0&zblx=txy&ycDefId=${YC_DEF_ID_GOV_BOND_MATURITY}&locale=zh_CN`
    const buf = await fetchBufferWithRetry({
      url,
      timeoutMs: 20_000,
      maxAttempts: 3,
    })
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    const ws = sheetName ? wb.Sheets[sheetName] : null
    if (!ws) throw new Error('chinabond xlsx missing sheet')
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][]
    const hdr = findHeaderRow(rows)
    if (!hdr) throw new Error('chinabond xlsx header not found')
    const out = new Map<string, Riskfree10yRawPoint>()
    for (let i = hdr.rowIdx + 1; i < rows.length; i += 1) {
      const row = rows[i] || []
      const date = normalizeExcelYmd10(row[hdr.dateCol])
      const term = toNum(row[hdr.termCol])
      const y = toNum(row[hdr.yieldCol])
      if (!date || term == null || y == null || term !== 10) continue
      const point = createPoint({
        date,
        valuePct: y,
        source: 'chinabond',
        sourceDetail: `year-xlsx-${year}`,
      })
      if (point) out.set(point.date, point)
    }
    cache.set(year, { expiresAt: Date.now() + 12 * 60 * 60_000, value: out })
    return out
  })().finally(() => inflight.delete(year))

  inflight.set(year, task)
  return await task
}

export async function fetchChinabond10yRange(input: {
  startDate: string
  endDate: string
}): Promise<Riskfree10yProviderResult> {
  const startYear = Number(input.startDate.slice(0, 4))
  const endYear = Number(input.endDate.slice(0, 4))
  const years: number[] = []
  for (let y = startYear; y <= endYear; y += 1) years.push(y)

  const maps = await Promise.all(years.map((year) => fetchYear(year)))
  const out = new Map<string, Riskfree10yRawPoint>()
  for (const m of maps) {
    for (const [date, point] of m.entries()) {
      if (date < input.startDate || date > input.endDate) continue
      out.set(date, point)
    }
  }
  return {
    source: 'chinabond',
    points: out,
    notes: ['source=chinabond', 'history=yearly-xlsx'],
  }
}

export async function fetchChinabond10yYearMap(year: number): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const m = await fetchYear(year)
  for (const [date, point] of m.entries()) out.set(date, point.valuePct)
  return out
}
