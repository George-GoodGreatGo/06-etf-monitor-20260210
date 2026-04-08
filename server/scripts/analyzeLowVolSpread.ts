import { getLowVolH30269Series } from '../lib/lowVol.js'

const out = await getLowVolH30269Series({ startDate: '20160101', endDate: '20991231' })
const s = out.data.series
const start = s.find((p) => p.date >= '2025-07-01')
const end = s.length ? s[s.length - 1] : null

if (!start || !end) {
  throw new Error('missing series')
}

const pick = (p: (typeof s)[number]) => ({
  date: p.date,
  dy: p.dividendYieldPct,
  y10: p.yield10yPct,
  raw: p.spreadRawPct,
  smooth: p.spreadSmoothPct,
})

const a = pick(start)
const b = pick(end)

const delta = {
  dy: a.dy != null && b.dy != null ? b.dy - a.dy : null,
  y10: a.y10 != null && b.y10 != null ? b.y10 - a.y10 : null,
  raw: a.raw != null && b.raw != null ? b.raw - a.raw : null,
  smooth: a.smooth != null && b.smooth != null ? b.smooth - a.smooth : null,
}

console.log(JSON.stringify({ a, b, delta }, null, 2))

