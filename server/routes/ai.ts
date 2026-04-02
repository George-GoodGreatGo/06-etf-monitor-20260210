import express, { type Request, type Response } from 'express'
import { readTop100InsightByDataDate, readTop100LatestSnapshot } from '../lib/supabaseRest.js'
import { getTop100InsightStatusDetail } from '../lib/top100Insight.js'
import { cozeStreamRunToSseEvents } from '../lib/coze.js'
import { buildWeeklyChartVercel } from './etf.js'
import { runAkshare } from '../lib/akshare.js'
import { getMarketLiquidityV5 } from '../lib/marketLiquidityV5Service.js'
import { buildMarketBoardInsightContextV2 } from '../lib/marketBoardInsightContextV2.js'
import { volcAgentChatToSseEvents } from '../lib/volcAgent.js'
import type { LiquidityV5Point } from '../lib/liquidityV5.js'
import type { EquityBondPoint } from '../lib/equityBondValue.js'

const router = express.Router()

async function resolveDataDate(rawDataDate: unknown): Promise<string> {
  const fromQuery = typeof rawDataDate === 'string' ? rawDataDate.trim() : ''
  if (fromQuery) return fromQuery
  const snap = await readTop100LatestSnapshot()
  return snap?.data_date ? String(snap.data_date).trim() : ''
}

router.get('/top100/insight', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  const q = req.query as Record<string, unknown>
  const dataDate = await resolveDataDate(q.dataDate)

  if (!dataDate) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 dataDate' })
    return
  }

  const row = await readTop100InsightByDataDate(dataDate)
  if (!row) {
    res.status(404).json({ success: false, error: 'not_found', message: `未找到解读：dataDate=${dataDate}` })
    return
  }

  res.status(200).json({
    success: true,
    data: {
      dataDate: row.data_date,
      snapshotAt: row.snapshot_at,
      source: row.source,
      markdown: row.markdown,
      rows: row.rows,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  })
})

router.get('/top100/insight/status', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  const q = req.query as Record<string, unknown>
  const dataDate = await resolveDataDate(q.dataDate)
  if (!dataDate) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 dataDate' })
    return
  }

  const detail = await getTop100InsightStatusDetail(dataDate)
  res.status(200).json({
    success: true,
    data: {
      dataDate,
      status: detail.status,
      lastError: detail.lastError,
      updatedAt: detail.updatedAt,
    },
  })
})

router.post('/top100/insight', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const dataDate = await resolveDataDate(b.dataDate)

  if (!dataDate) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 dataDate' })
    return
  }

  const row = await readTop100InsightByDataDate(dataDate)
  if (!row) {
    res.status(404).json({ success: false, error: 'not_found', message: `未找到解读：dataDate=${dataDate}` })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    ;(res as Response & { flushHeaders?: () => void }).flushHeaders?.()
  } catch {
    void 0
  }

  res.write(': stream-open\n\n')
  res.write(`data: ${JSON.stringify({ type: 'answer', content: { answer: row.markdown }, finish: true })}\n\n`)
  res.write(`data: ${JSON.stringify({ type: 'end', status: 'success' })}\n\n`)
  res.end()
})

router.get('/etf/detail/insight', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  const q = req.query as Record<string, unknown>
  const code = typeof q.code === 'string' ? q.code.trim() : ''
  
  if (!code) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 code' })
    return
  }

  const { readEtfWeeklyInsight } = await import('../lib/supabaseRest.js')
  const row = await readEtfWeeklyInsight(code)
  if (!row) {
    res.status(200).json({ success: true, data: null })
    return
  }

  const createdTime = new Date(row.created_at).getTime()
  const now = Date.now()
  const ageHours = (now - createdTime) / (1000 * 60 * 60)

  if (ageHours > 23) {
    // expired
    res.status(200).json({ success: true, data: null })
    return
  }

  res.status(200).json({
    success: true,
    data: {
      code: row.code,
      insightText: row.insight_text,
      createdAt: row.created_at,
    },
  })
})

router.post('/etf/detail/insight', async (req: Request, res: Response) => {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    ;(res as Response & { flushHeaders?: () => void }).flushHeaders?.()
  } catch {
    void 0
  }

  const writeEvent = (o: Record<string, unknown>) => {
    try {
      res.write(`data: ${JSON.stringify(o)}\n\n`)
    } catch {
      void 0
    }
  }

  res.write(': stream-open\n\n')

  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const code = typeof b.code === 'string' ? b.code.trim() : ''
  if (!code) {
    writeEvent({ type: 'end', status: 'error', message: '缺少 code' })
    res.end()
    return
  }

  const url = String(process.env.COZE_DETAIL_STREAM_RUN_URL || '').trim()
  const token = String(process.env.COZE_DETAIL_BEARER_TOKEN || '').trim()
  if (!url || !token) {
    writeEvent({ type: 'end', status: 'error', message: '缺少服务端环境变量：COZE_DETAIL_STREAM_RUN_URL / COZE_DETAIL_BEARER_TOKEN' })
    res.end()
    return
  }

  let nameCn: string | null = null
  try {
    const snap = await readTop100LatestSnapshot()
    const row = (snap?.rows as unknown[] | undefined)?.find((r) => {
      if (!r || typeof r !== 'object') return false
      const o = r as Record<string, unknown>
      return typeof o.code === 'string' && o.code === code
    }) as Record<string, unknown> | undefined
    if (row && typeof row.name === 'string') nameCn = row.name
  } catch {
    nameCn = null
  }

  const adjust = 'qfq'
  const weeklyOut = process.env.VERCEL
    ? await buildWeeklyChartVercel(code, adjust)
    : await runAkshare(`weekly-chart:v1:${code}:${adjust}`, ['weekly-chart', '--code', code, '--adjust', adjust], {
        cacheTtlMs: 600_000,
        timeoutMs: 180_000,
      })

  if (weeklyOut.success !== true) {
    writeEvent({ type: 'end', status: 'error', message: weeklyOut.message || weeklyOut.error || '周线数据获取失败' })
    res.end()
    return
  }

  const series = (weeklyOut.data as Record<string, unknown>).series as Record<string, unknown>
  const price = Array.isArray((series as Record<string, unknown>).price) ? ((series as Record<string, unknown>).price as unknown[]) : []
  const ema20 = Array.isArray((series as Record<string, unknown>).ema20) ? ((series as Record<string, unknown>).ema20 as unknown[]) : []
  const sma60 = Array.isArray((series as Record<string, unknown>).sma60) ? ((series as Record<string, unknown>).sma60 as unknown[]) : []
  const bbObj = ((series as Record<string, unknown>).bb as Record<string, unknown>) || {}
  const bbMb = Array.isArray(bbObj.mb) ? (bbObj.mb as unknown[]) : []
  const bbUb = Array.isArray(bbObj.ub) ? (bbObj.ub as unknown[]) : []
  const bbLb = Array.isArray(bbObj.lb) ? (bbObj.lb as unknown[]) : []
  const bbBw = Array.isArray(bbObj.bandwidth) ? (bbObj.bandwidth as unknown[]) : []
  const volume = Array.isArray((series as Record<string, unknown>).volume) ? ((series as Record<string, unknown>).volume as unknown[]) : []
  const rsi14 = Array.isArray((series as Record<string, unknown>).rsi14) ? ((series as Record<string, unknown>).rsi14 as unknown[]) : []
  const macdObj = ((series as Record<string, unknown>).macd as Record<string, unknown>) || {}
  const macdLine = Array.isArray(macdObj.macd) ? (macdObj.macd as unknown[]) : []
  const macdSignal = Array.isArray(macdObj.signal) ? (macdObj.signal as unknown[]) : []
  const macdHist = Array.isArray(macdObj.hist) ? (macdObj.hist as unknown[]) : []

  const toMap = (arr: unknown[]) => {
    const m = new Map<number, number>()
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue
      const o = it as Record<string, unknown>
      const t = typeof o.time === 'number' ? o.time : Number(o.time)
      const v = typeof o.value === 'number' ? o.value : o.value == null ? NaN : Number(o.value)
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue
      m.set(t, v)
    }
    return m
  }

  const ema20Map = toMap(ema20)
  const sma60Map = toMap(sma60)
  const bbMbMap = toMap(bbMb)
  const bbUbMap = toMap(bbUb)
  const bbLbMap = toMap(bbLb)
  const bbBwMap = toMap(bbBw)
  const volumeMap = toMap(volume)
  const rsi14Map = toMap(rsi14)
  const macdLineMap = toMap(macdLine)
  const macdSignalMap = toMap(macdSignal)
  const macdHistMap = toMap(macdHist)

  const rows = []
  for (const it of price) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const t = typeof o.time === 'number' ? o.time : Number(o.time)
    const v = typeof o.value === 'number' ? o.value : o.value == null ? NaN : Number(o.value)
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue
    const d = new Date(t)
    const ymd = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''

    rows.push({
      week_end_date: ymd,
      week_end_utc_ms: t,
      close_price_qfq: v,
      ema_20w: ema20Map.get(t) ?? null,
      sma_60w: sma60Map.get(t) ?? null,
      bollinger_20w_2sd: {
        middle: bbMbMap.get(t) ?? null,
        upper: bbUbMap.get(t) ?? null,
        lower: bbLbMap.get(t) ?? null,
        bandwidth: bbBwMap.get(t) ?? null,
      },
      volume_week: volumeMap.get(t) ?? null,
      rsi_14w: rsi14Map.get(t) ?? null,
      macd_12_26_9: {
        line: macdLineMap.get(t) ?? null,
        signal: macdSignalMap.get(t) ?? null,
        hist: macdHistMap.get(t) ?? null,
      },
    })
  }

  const maxWeeks = 200
  const trimmedRows = rows.slice(Math.max(0, rows.length - maxWeeks))

  const payload = {
    symbol: code,
    name_cn: nameCn,
    adjustment: adjust,
    freq: 'W',
    weekly_count: trimmedRows.length,
    data: trimmedRows,
  }

  let fullAnswer = ''

  const interceptWriteEvent = (o: Record<string, unknown>) => {
    if (o.type === 'answer' && o.content && typeof (o.content as Record<string, unknown>).answer === 'string') {
      fullAnswer += (o.content as Record<string, unknown>).answer
    }
    writeEvent(o)
  }

  try {
    await cozeStreamRunToSseEvents(JSON.stringify(payload), {
      url,
      token,
      onEvent: interceptWriteEvent,
    })
    
    // Save to database
    if (fullAnswer.trim()) {
      const { upsertEtfWeeklyInsight } = await import('../lib/supabaseRest.js')
      await upsertEtfWeeklyInsight(code, fullAnswer.trim()).catch(e => {
        console.error('Failed to save ETF weekly insight to DB:', e)
      })
    }
  } catch (e) {
    writeEvent({ type: 'end', status: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    res.end()
  }
})

router.post('/market/insight', async (req: Request, res: Response) => {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    ;(res as Response & { flushHeaders?: () => void }).flushHeaders?.()
  } catch {
    void 0
  }

  const writeEvent = (o: Record<string, unknown>) => {
    try {
      res.write(`data: ${JSON.stringify(o)}\n\n`)
    } catch {
      void 0
    }
  }

  res.write(': stream-open\n\n')

  const ac = new AbortController()
  req.on('close', () => {
    try {
      ac.abort()
    } catch {
      void 0
    }
  })

  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const continueFrom = typeof b.continueFrom === 'string' ? b.continueFrom : ''

  const baseUrl = String(process.env.VOLCENGINE_AGENT_API_URL || 'https://open.feedcoopapi.com/agent_api/agent/chat/completion').trim()
  const apiKey = String(process.env.VOLCENGINE_AGENT_API_KEY || process.env.VOLCENGINE_API_KEY || '').trim()
  const botId = String(process.env.VOLCENGINE_AGENT_BOT_ID || '').trim()
  const model = 'thinking'
  const searchMode = 'volc_agent_builtin'

  writeEvent({
    type: 'meta',
    provider: 'volcengine_agent',
    model,
    baseUrl,
    searchMode,
    hasBotId: Boolean(botId),
  })

  if (!apiKey) {
    writeEvent({ type: 'end', status: 'error', message: '缺少服务端环境变量：VOLCENGINE_AGENT_API_KEY' })
    res.end()
    return
  }
  if (!botId) {
    writeEvent({ type: 'end', status: 'error', message: '缺少服务端环境变量：VOLCENGINE_AGENT_BOT_ID' })
    res.end()
    return
  }

  let marketData: Record<string, unknown>
  try {
    marketData = await getMarketLiquidityV5()
  } catch (e) {
    writeEvent({ type: 'end', status: 'error', message: e instanceof Error ? e.message : String(e) })
    res.end()
    return
  }

  const ok = marketData && typeof marketData === 'object' && marketData.success === true
  if (!ok) {
    const msg =
      marketData && typeof marketData === 'object' && typeof (marketData as Record<string, unknown>).message === 'string'
        ? String((marketData as Record<string, unknown>).message)
        : '市场数据不可用'
    writeEvent({ type: 'end', status: 'error', message: msg })
    res.end()
    return
  }

  const dataObj = (marketData as Record<string, unknown>).data as Record<string, unknown>
  const metaObj = (marketData as Record<string, unknown>).meta as Record<string, unknown>
  const series: LiquidityV5Point[] = dataObj && Array.isArray(dataObj.series) ? (dataObj.series as LiquidityV5Point[]) : []
  const equityBondSeries: EquityBondPoint[] =
    dataObj && typeof dataObj.equityBond === 'object' && dataObj.equityBond && Array.isArray((dataObj.equityBond as Record<string, unknown>).series)
      ? ((dataObj.equityBond as Record<string, unknown>).series as EquityBondPoint[])
      : []

  const context = buildMarketBoardInsightContextV2({
    series,
    equityBond: equityBondSeries,
    windowDays: 720,
  })

  const notes = metaObj && Array.isArray((metaObj as Record<string, unknown>).notes) ? (metaObj as Record<string, unknown>).notes : null
  const source = metaObj && typeof (metaObj as Record<string, unknown>).source === 'string' ? String((metaObj as Record<string, unknown>).source) : null
  const dataDate = metaObj && typeof (metaObj as Record<string, unknown>).dataDate === 'string' ? String((metaObj as Record<string, unknown>).dataDate) : null
  const staleReason =
    Array.isArray(notes)
      ? notes.find((x) => typeof x === 'string' && x.includes('已回退上次成功快照'))
      : null
  const staleSnapshot = source === 'stale-cache-from-last-success' || typeof staleReason === 'string'
  const dataSourceType = staleSnapshot
    ? 'snapshot'
    : source && source.includes('codebuddy:financedata')
      ? 'primary'
      : source && (source.includes('akshare') || source.includes('eastmoney:') || source.includes('csindex'))
        ? 'fallback'
        : 'primary'
  const dataSourceLabel =
    dataSourceType === 'snapshot'
      ? '快照数据源（最近一次成功快照）'
      : dataSourceType === 'fallback'
        ? source && source.includes('eastmoney:') ? '替代数据源（Eastmoney HTTP）' : '替代数据源（AkShare）'
        : '主数据源（financedata）'

  writeEvent({
    type: 'meta',
    dataSourceType,
    dataSourceLabel,
    dataDate,
    marketSource: source,
  })

  if (staleSnapshot) {
    writeEvent({
      type: 'meta',
      staleSnapshot: true,
      staleMessage: '当前为最近一次成功快照（非实时）',
      staleReason: typeof staleReason === 'string' ? staleReason : null,
    })
  }

  const developer = [
    '总是用中文回复。',
    '你是“中国A股市场”的专业市场解读助手，拥有如巴菲特的价值投资追求，和查理芒格的多元分析视角，目标是始终以负责任、专业的视角，帮助用户进行理性决策。',
    '你会收到结构化市场明细数据（含字段定义、单位、720天窗口数据、短中长期汇总）。',
    '任务1：首先进行数据总结，作为资深交易员，检视所有数据点，明确短期（7/20日）、中期（60/120日）、长期（252日）的规律和市场动态，覆盖关键指标并说明变化方向与幅度。',
    '任务2：基于短期与中期趋势的指标变动特点，结合数据点和判断，主动执行联网搜索并归纳A股市场短期、中期波动原因（聚焦回答为什么下跌、为什么上涨，为什么波动。包括货币政策、财政政策、市场、机构观点、机构策略、机构偏好、大V言论）。资讯结论必须给出可追溯 URL（优先官方/主流财经媒体/券商研报）；若证据不足要明确说明不足点。',
    '任务3：站在专业投资者、理性交易者视角，对明细数据总结，结合资讯结论，给出市场机会识别、风险识别与情势建议（非个股买卖指令）。',
    '注意：在任务2中进行波动原因搜索时，必须与数据的逻辑趋势保持一致。重点是对指标信号进行解释、支撑和归因，但也不能强行牵强解释。注意要使用最近7-14天内（且匹配对应的数据周期）的新闻资讯、媒体报道和大V言论，以确保时效性。',
    '输出为 Markdown，结构固定包含：概览、短期趋势/分析、中期趋势/分析、长期趋势/分析、整体解读、机会识别、风险识别、情势建议、独立判断。免责声明。',
    '不得编造新闻、机构观点或链接；若无可靠来源，明确说明“暂无可靠来源”。',
    '必须包含“仅供参考，不构成投资建议”。',
  ].join('\n')

  const user = JSON.stringify(
    {
      market: context,
      marketNotes: notes,
      marketSource: source,
    },
    null,
    2,
  )

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: developer },
    { role: 'user', content: user },
  ]
  if (continueFrom.trim()) {
    const tail = continueFrom.length > 6000 ? continueFrom.slice(continueFrom.length - 6000) : continueFrom
    messages.push({ role: 'assistant', content: tail })
    messages.push({ role: 'user', content: '继续从上次中断处输出剩余内容；不要重复已输出段落；保持相同 Markdown 结构与语气。' })
  }

  writeEvent({
    type: 'debug',
    request: {
      baseUrl,
      model,
      searchMode,
      botId,
      temperature: 0.4,
      maxTokens: 2600,
      stream: true,
      outputReasoningContent: true,
    },
    prompts: {
      developer,
      user,
    },
  })

  try {
    await volcAgentChatToSseEvents({
      apiKey,
      botId,
      endpoint: baseUrl,
      messages: messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      model: 'thinking',
      stream: true,
      signal: ac.signal,
      onEvent: writeEvent,
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError') {
      res.end()
      return
    }
    writeEvent({ type: 'end', status: 'error', message: e instanceof Error ? e.message : String(e) })
  } finally {
    res.end()
  }
})

export default router
