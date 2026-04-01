type FinanceDataResponse = {
  data?: {
    fields?: string[]
    items?: unknown[][]
  }
}

export async function fetchFinanceData(input: {
  apiName: string
  params: Record<string, unknown>
  fields: string
}): Promise<Record<string, unknown>[]> {
  const apiName = String(input.apiName || '').trim()
  const fields = String(input.fields || '').trim()
  if (!apiName || !fields) return []

  const url = 'https://www.codebuddy.cn/v2/tool/financedata'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_name: apiName,
      params: input.params || {},
      fields,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`financedata failed: HTTP ${res.status} ${text}`)
  }

  const j = (await res.json().catch(() => null)) as (FinanceDataResponse & { code?: number; msg?: string }) | null
  
  if (j && typeof j === 'object' && 'code' in j && j.code !== 0) {
    throw new Error(`financedata API error: ${j.msg || 'unknown error'}`)
  }

  const data = j && typeof j === 'object' ? j.data : null
  const respFields = Array.isArray(data?.fields) ? data?.fields : null
  const respItems = Array.isArray(data?.items) ? data?.items : null
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

