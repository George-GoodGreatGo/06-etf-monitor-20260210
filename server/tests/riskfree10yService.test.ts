import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

import { getRiskfree10ySeries, getRiskfree10yValueByDate, probeRiskfree10y, resolveRiskfree10ySeries } from '../lib/riskfree10yService.js'

function createChinabondWorkbook(): Buffer {
  const rows = [
    ['日期', '标准期限(年)', '收益率(%)'],
    ['2026-04-14', 10, 1.79],
    ['2026-04-15', 10, 1.78],
    ['2026-04-16', 10, 1.781],
    ['2026-04-17', 10, 1.778],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

{
  const out = resolveRiskfree10ySeries({
    startDate: '2026-04-14',
    endDate: '2026-04-16',
    sources: {
      chinamoney: new Map([
        ['2026-04-14', 1.8],
        ['2026-04-15', 1.81],
      ]),
      chinabond: new Map([
        ['2026-04-14', 1.79],
        ['2026-04-15', 1.95],
      ]),
      eastmoney: new Map([
        ['2026-04-14', 1.81],
        ['2026-04-16', 1.82],
      ]),
    },
  })
  assert.equal(out.byDate.get('2026-04-14'), 1.8)
  assert.equal(out.resolved.get('2026-04-14')?.source, 'chinamoney')
  assert.equal(out.byDate.get('2026-04-16'), 1.82)
  assert.equal(out.resolved.get('2026-04-16')?.notes[0], 'rule=single_source_strict')
}

{
  const out = resolveRiskfree10ySeries({
    startDate: '2026-04-14',
    endDate: '2026-04-15',
    sources: {
      chinamoney: new Map(),
      chinabond: new Map([
        ['2026-04-14', 1.8],
        ['2026-04-15', 1.81],
      ]),
      eastmoney: new Map([
        ['2026-04-14', 1.82],
        ['2026-04-15', 1.83],
      ]),
      worldgovernmentbonds: new Map([
        ['2026-04-14', 1.801],
      ]),
    },
  })
  assert.equal(out.resolved.get('2026-04-14')?.source, 'chinabond+worldgovernmentbonds')
  assert.equal(out.byDate.get('2026-04-14'), 1.8005)
}

{
  const out = resolveRiskfree10ySeries({
    startDate: '2026-04-14',
    endDate: '2026-04-16',
    sources: {
      chinamoney: new Map([
        ['2026-04-14', 1.8],
      ]),
      chinabond: new Map(),
      eastmoney: new Map([
        ['2026-04-15', 1.82],
        ['2026-04-16', 2.6],
      ]),
      worldgovernmentbonds: new Map(),
    },
  })
  assert.equal(out.byDate.get('2026-04-14'), 1.8)
  assert.equal(out.byDate.get('2026-04-15'), 1.82)
  assert.equal(out.byDate.has('2026-04-16'), false)
  assert.ok(out.notes.some((x) => x.includes('single_source_jump_gt_50bp')))
}

{
  const out = resolveRiskfree10ySeries({
    startDate: '2026-02-20',
    endDate: '2026-02-23',
    sources: {
      chinamoney: new Map(),
      chinabond: new Map(),
      eastmoney: new Map(),
      worldgovernmentbonds: new Map([
        ['2026-02-23', 1.812],
      ]),
    },
  })
  assert.equal(out.byDate.get('2026-02-23'), 1.812)
  assert.equal(out.resolved.get('2026-02-23')?.source, 'worldgovernmentbonds')
}

{
  const picked = getRiskfree10yValueByDate({
    date: '2026-04-17',
    byDate: new Map([
      ['2026-04-15', 1.8],
    ]),
    lookbackDays: 7,
  })
  assert.equal(picked.valuePct, 1.8)
  assert.equal(picked.matchedDate, '2026-04-15')
  assert.equal(picked.lookbackDaysUsed, 2)
}

const origFetch = globalThis.fetch
globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
  const u = String(url || '')
  if (u.includes('/r/cms/www/chinamoney/data/currency/sdds-intr-rate.json')) {
    return new Response(
      JSON.stringify({
        data: {
          showDateCN: '2026-04-17',
          bond10Y: '1.7781',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  if (u.includes('SddsIntrRateGovYldHis')) {
    return new Response(
      JSON.stringify({
        data: {
          pageTotal: 1,
        },
        records: [
          { dateString: '2026-04-14', tenRate: '1.7900' },
          { dateString: '2026-04-15', tenRate: '1.7854' },
          { dateString: '2026-04-16', tenRate: '1.7810' },
          { dateString: '2026-04-17', tenRate: '1.7781' },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  if (u.includes('yield.chinabond.com.cn')) {
    return new Response(createChinabondWorkbook(), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  }
  if (u.includes('RPTA_WEB_TREASURYYIELD')) {
    return new Response(
      JSON.stringify({
        success: true,
        result: {
          data: [
            { SOLAR_DATE: '2026-04-17 00:00:00', EMM00166466: 0 },
            { SOLAR_DATE: '2026-04-16 00:00:00', EMM00166466: 1.7812 },
            { SOLAR_DATE: '2026-04-15 00:00:00', EMM00166466: 1.7809 },
            { SOLAR_DATE: '2026-04-14 00:00:00', EMM00166466: 1.7902 },
          ],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  if (u.includes('worldgovernmentbonds.com/wp-json/common/v1/historical')) {
    return new Response(
      JSON.stringify({
        result: {
          quote: {
            '1': { DATA_VAL: '2026-04-14', CLOSE_VAL: 1.7901, TIME_VAL: '2026-04-14 00:15:08' },
            '2': { DATA_VAL: '2026-04-15', CLOSE_VAL: 1.7807, TIME_VAL: '2026-04-15 00:15:08' },
            '3': { DATA_VAL: '2026-04-16', CLOSE_VAL: 1.7811, TIME_VAL: '2026-04-16 00:15:08' },
            '4': { DATA_VAL: '2026-04-17', CLOSE_VAL: 1.7782, TIME_VAL: '2026-04-17 00:15:08' },
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  throw new Error(`unexpected fetch: ${u}`)
}) as typeof fetch

const serviceOut = await getRiskfree10ySeries({
  startDate: '2026-04-14',
  endDate: '2026-04-17',
  forceRefresh: true,
})
assert.equal(serviceOut.byDate.size, 4)
assert.equal(serviceOut.byDate.get('2026-04-17'), 1.7781)
assert.equal(serviceOut.resolved.get('2026-04-17')?.source, 'chinamoney')
assert.ok(serviceOut.meta.providerNotes.some((x) => x.includes('filtered_placeholder_zero=2026-04-17')))

const probe = await probeRiskfree10y({ date: '2026-04-17', forceRefresh: true })
assert.equal(probe.ok, true)
assert.equal(probe.matchedDate, '2026-04-17')
assert.equal(probe.source, 'chinamoney')
assert.deepEqual(
  probe.details.map((x) => x.source).sort(),
  ['chinabond', 'chinamoney', 'eastmoney', 'worldgovernmentbonds'],
)
assert.equal(probe.details.find((x) => x.source === 'chinamoney')?.latestDate, '2026-04-17')

globalThis.fetch = origFetch
