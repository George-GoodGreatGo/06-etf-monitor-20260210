export function formatYmd(ymd: string | null | undefined) {
  if (!ymd) return '—'
  return ymd
}

export function parseIsoToLocal(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatCompactNumber(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const fmt = (v: number) => {
    const s = v.toFixed(v >= 100 ? 0 : 2)
    return s.replace(/\.00$/, '')
  }

  if (abs >= 1e12) return `${sign}${fmt(abs / 1e12)}万亿`
  if (abs >= 1e8) return `${sign}${fmt(abs / 1e8)}亿`
  if (abs >= 1e4) return `${sign}${fmt(abs / 1e4)}万`
  return `${sign}${fmt(abs)}`
}

export function formatPct(v: number) {
  const pct = Math.round(v * 100) / 100
  const s = pct.toFixed(2).replace(/\.00$/, '')
  return `${pct > 0 ? '+' : ''}${s}%`
}

