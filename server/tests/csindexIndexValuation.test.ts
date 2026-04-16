import assert from 'node:assert/strict'
import xlsx from 'xlsx'
import { fetchCsindexIndexValuationSeries } from '../lib/csindexIndexValuation.js'

function excelSerialFromYmd(ymd: string): number {
  const s = String(ymd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`bad ymd: ${s}`)
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  const ms = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const base = Date.UTC(1899, 11, 30, 0, 0, 0, 0)
  return (ms - base) / 86400000
}

const origFetch = globalThis.fetch

globalThis.fetch = (async () => {
  const ws1 = xlsx.utils.aoa_to_sheet([['not a header']])
  const header = ['日期', '说明', '市盈率', '股息率']
  const rows = [
    header,
    [excelSerialFromYmd('2026-04-11'), '', 12.3, 2.1],
    [excelSerialFromYmd('2026-04-12'), '', 12.4, 2.2],
    [excelSerialFromYmd('2026-04-13'), '', 12.5, 2.3],
  ]
  const ws2 = xlsx.utils.aoa_to_sheet(rows)
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws1, 'S1')
  xlsx.utils.book_append_sheet(wb, ws2, 'S2')
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xls' }) as Buffer
  return new Response(buf, { status: 200 })
}) as typeof fetch

const series = await fetchCsindexIndexValuationSeries({ indexCode: '932315', cacheTtlMs: 0 })
assert.equal(series.length, 3)
assert.equal(series[0]?.date, '2026-04-11')
assert.equal(series[2]?.date, '2026-04-13')
assert.equal(series[2]?.pe, 12.5)
assert.equal(series[2]?.dividendYieldPct, 2.3)

globalThis.fetch = origFetch
