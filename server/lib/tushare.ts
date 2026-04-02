type TushareResponse = {
  code?: number
  msg?: string
  data?: { fields?: string[]; items?: unknown[][] }
}

export async function fetchTushare(input: {
  token: string
  apiName: string
  params: Record<string, unknown>
  fields: string
}): Promise<Record<string, unknown>[]> {
  const token = String(input.token || '').trim()
  const apiName = String(input.apiName || '').trim()
  const fields = String(input.fields || '').trim()
  if (!token || !apiName || !fields) return []

  const res = await fetch('https://api.tushare.pro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      api_name: apiName,
      token,
      params: input.params || {},
      fields,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tushare failed: HTTP ${res.status} ${text}`)
  }

  const j = (await res.json().catch(() => null)) as TushareResponse | null
  if (!j || typeof j !== 'object') return []
  if (typeof j.code === 'number' && j.code !== 0) throw new Error(`tushare API error: ${j.msg || 'unknown error'}`)

  const respFields = Array.isArray(j.data?.fields) ? j.data?.fields : null
  const respItems = Array.isArray(j.data?.items) ? j.data?.items : null
  if (!respFields || !respItems) return []

  const out: Record<string, unknown>[] = []
  for (const row of respItems) {
    if (!Array.isArray(row)) continue
    const o: Record<string, unknown> = {}
    for (let i = 0; i < respFields.length; i += 1) {
      const k = respFields[i]
      if (typeof k !== 'string' || !k) continue
      o[k] = row[i]
    }
    out.push(o)
  }
  return out
}

