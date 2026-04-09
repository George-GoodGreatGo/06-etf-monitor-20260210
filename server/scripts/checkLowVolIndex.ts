import { getLowVolIndexSeries } from '../lib/lowVol.js'

async function main() {
  const code = process.argv[2] || '932365'
  const out = await getLowVolIndexSeries({ code, startDate: '20180101', endDate: '20991231' })
  const series = out.data.series
  const last = series.length ? series[series.length - 1] : null
  const lastDy = [...series].reverse().find((p) => typeof p.dividendYieldPct === 'number' && Number.isFinite(p.dividendYieldPct))
  const lastSpread = [...series].reverse().find((p) => typeof p.spreadPct === 'number' && Number.isFinite(p.spreadPct))
  console.log('code', code)
  console.log('dataDate', out.meta.dataDate)
  console.log('last', last)
  console.log('lastDy', lastDy?.date, lastDy?.dividendYieldPct)
  console.log('lastSpread', lastSpread?.date, lastSpread?.spreadPct, lastSpread?.spreadPctRank10y)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

