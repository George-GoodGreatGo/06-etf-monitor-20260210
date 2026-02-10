import { readFile } from 'node:fs/promises'

type CacheFile = {
  cachedAt: string
  dataDate: string
  rows: unknown
}

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

async function main() {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')

  const text = await readFile('api/python/.cache/top100_latest.json', 'utf-8')
  const j = JSON.parse(text) as CacheFile
  if (!j || typeof j !== 'object') throw new Error('bad cache json')
  if (!j.cachedAt || !j.dataDate || !Array.isArray(j.rows) || j.rows.length === 0) {
    throw new Error('bad cache content')
  }

  const payload = {
    id: 1,
    fetched_at: j.cachedAt,
    data_date: j.dataDate,
    cached_at: j.cachedAt,
    source: 'akshare:sina',
    notes: [
      'Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。',
      '成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。',
    ],
    rows: j.rows,
    updated_at: new Date().toISOString(),
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/top100_latest`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write failed: HTTP ${res.status} ${body}`)
  }

  const out = await res.json().catch(() => null)
  process.stdout.write(JSON.stringify({ success: true, written: out }, null, 2))
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(msg)
  process.exit(1)
})

