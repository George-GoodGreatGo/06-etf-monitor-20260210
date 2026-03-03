import { cozeStreamRunToMarkdown } from './coze.js'
import {
  insertTop100InsightIgnoreDuplicates,
  readTop100InsightByDataDate,
  type Top100InsightRow,
} from './supabaseRest.js'

export type Top100InsightGenerateStatus = 'idle' | 'generating' | 'ready'

const inflightEnsures = new Map<string, Promise<Top100InsightRow>>()

export function buildTop100InsightPromptText(input: {
  dataDate: string
  snapshotAt: string | null
  source: string | null
  rows: unknown[]
}) {
  const payload = {
    snapshot: {
      dataDate: input.dataDate,
      snapshotAt: input.snapshotAt,
      source: input.source || 'supabase:snapshot',
      count: input.rows.length,
    },
    rows: input.rows.map((r) => {
      if (!r || typeof r !== 'object') return r
      const o = r as Record<string, unknown>
      return {
        latestTradingDate: typeof o.latestTradingDate === 'string' ? o.latestTradingDate : null,
        code: typeof o.code === 'string' ? o.code : null,
        name: typeof o.name === 'string' ? o.name : null,
        volume: typeof o.volume === 'number' ? o.volume : o.volume == null ? null : Number(o.volume),
        turnover: typeof o.turnover === 'number' ? o.turnover : o.turnover == null ? null : Number(o.turnover),
        turnoverChangePct1d:
          typeof o.turnoverChangePct1d === 'number'
            ? o.turnoverChangePct1d
            : o.turnoverChangePct1d == null
              ? null
              : Number(o.turnoverChangePct1d),
        turnoverChangePct7dAvg:
          typeof o.turnoverChangePct7dAvg === 'number'
            ? o.turnoverChangePct7dAvg
            : o.turnoverChangePct7dAvg == null
              ? null
              : Number(o.turnoverChangePct7dAvg),
        z90: typeof o.z90 === 'number' ? o.z90 : o.z90 == null ? null : Number(o.z90),
        dataStatus: typeof o.dataStatus === 'string' ? o.dataStatus : null,
      }
    }),
  }

  return [
    '你是一名专业的中国ETF市场分析师。请基于以下 Top200 ETF 异动监测快照数据，给出当天的解读。',
    '要求：',
    '1) 用中文输出；',
    '2) 先给 3-5 条总览结论；',
    '3) 再给 5-10 条重点异动（指出代码/名称/成交额/环比/较7日均/90日Z，并解释可能原因）；',
    '4) 明确说明“这是一份快照数据”，并引用快照时间；',
    '5) 不要编造数据；如果字段为空请说明“数据不完整/不可用”。',
    '',
    '数据如下（JSON）：',
    JSON.stringify(payload),
  ].join('\n')
}

export async function ensureTop100Insight(
  dataDate: string,
  snapshotAt: string | null,
  source: string | null,
  rows: unknown[],
): Promise<Top100InsightRow> {
  const d = String(dataDate || '').trim()
  if (!d) throw new Error('missing dataDate')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('missing rows')

  const existing = await readTop100InsightByDataDate(d)
  if (existing) return existing

  const inflight = inflightEnsures.get(d)
  if (inflight) return inflight

  const task = (async () => {
    const before = await readTop100InsightByDataDate(d)
    if (before) return before

    const promptText = buildTop100InsightPromptText({
      dataDate: d,
      snapshotAt: snapshotAt ? String(snapshotAt) : null,
      source: source ? String(source) : null,
      rows,
    })

    const { markdown } = await cozeStreamRunToMarkdown(promptText)

    const inserted = await insertTop100InsightIgnoreDuplicates({
      data_date: d,
      snapshot_at: snapshotAt ? String(snapshotAt) : null,
      source: source ? String(source) : null,
      rows,
      markdown,
      updated_at: new Date().toISOString(),
    })

    if (inserted) return inserted

    const after = await readTop100InsightByDataDate(d)
    if (!after) throw new Error(`写入 top100_insight 失败或未生效：dataDate=${d}`)
    return after
  })()

  inflightEnsures.set(d, task)
  try {
    return await task
  } finally {
    const current = inflightEnsures.get(d)
    if (current === task) inflightEnsures.delete(d)
  }
}

export async function getTop100InsightGenerateStatus(dataDate: string): Promise<Top100InsightGenerateStatus> {
  const d = String(dataDate || '').trim()
  if (!d) return 'idle'
  if (inflightEnsures.has(d)) return 'generating'
  const existing = await readTop100InsightByDataDate(d)
  return existing ? 'ready' : 'idle'
}
