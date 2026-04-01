import express, { type Request, type Response } from 'express'
import { readTop100InsightByDataDate, readTop100LatestSnapshot } from '../lib/supabaseRest.js'
import { getTop100InsightStatusDetail } from '../lib/top100Insight.js'
import { cozeStreamRunToSseEvents } from '../lib/coze.js'
import { buildWeeklyChartVercel } from './etf.js'
import { runAkshare } from '../lib/akshare.js'
import { aihubmixChatCompletionsToSseEvents } from '../lib/aihubmix.js'
import { getMarketLiquidityV5 } from '../lib/marketLiquidityV5Service.js'
import { buildMarketBoardInsightContextV2 } from '../lib/marketBoardInsightContextV2.js'
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
  const enableWebSearch = typeof b.enableWebSearch === 'boolean' ? b.enableWebSearch : true
  const continueFrom = typeof b.continueFrom === 'string' ? b.continueFrom : ''

  const baseUrl = String(process.env.AIHUBMIX_BASE_URL || 'https://aihubmix.com/v1').trim()
  const apiKey = String(process.env.AIHUBMIX_API_KEY || '').trim()
  const baseModel = String(process.env.AIHUBMIX_MODEL || 'mimo-v2-flash-free').trim()
  const isWebSearchOptionsModel = baseModel.startsWith('gemini-') || baseModel.startsWith('gpt-')
  const baseExtraBody =
    baseModel === 'qwen3-max-thinking'
      ? { enable_thinking: true }
      : baseModel.startsWith('mimo-')
        ? { thinking: { type: 'true' } }
        : undefined
  const searchMode = enableWebSearch ? (isWebSearchOptionsModel ? 'web_search_options' : 'surfing') : 'none'
  const model = enableWebSearch && !isWebSearchOptionsModel ? `${baseModel}:surfing` : baseModel
  const extraBody =
    enableWebSearch && isWebSearchOptionsModel
      ? { ...(baseExtraBody || {}), web_search_options: {} }
      : baseExtraBody || undefined
  const maxCompletionTokens = baseModel.startsWith('mimo-') ? 2600 : undefined

  writeEvent({
    type: 'meta',
    provider: 'aihubmix',
    enableWebSearch,
    model,
    baseModel,
    searchMode,
  })

  if (!apiKey) {
    writeEvent({ type: 'end', status: 'error', message: '缺少服务端环境变量：AIHUBMIX_API_KEY' })
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

  const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const deltaByDays = <T,>(arr: T[], days: number, pick: (x: T) => number | null | undefined) => {
    if (!Array.isArray(arr) || arr.length <= days) return null
    const a = pick(arr[arr.length - 1])
    const b = pick(arr[arr.length - 1 - days])
    if (!isFiniteNum(a) || !isFiniteNum(b)) return null
    return a - b
  }

  const buildDateRange = (ymd: string | null) => {
    const s = typeof ymd === 'string' ? ymd.trim() : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { from: null, to: null }
    const year = Number(s.slice(0, 4))
    const month = Number(s.slice(5, 7))
    const day = Number(s.slice(8, 10))
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return { from: null, to: null }
    const toMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    const fromMs = toMs - 14 * 24 * 60 * 60 * 1000
    const to = new Date(toMs).toISOString().slice(0, 10)
    const from = new Date(fromMs).toISOString().slice(0, 10)
    return { from, to }
  }

  const range = buildDateRange(context?.meta?.dataDate ?? null)
  const queries: string[] = []
  const addQ = (q: string) => {
    const s = String(q || '').trim()
    if (!s) return
    if (queries.includes(s)) return
    queries.push(s)
  }

  const latest = context?.latest as Record<string, unknown> | undefined
  const liquidity = latest && typeof latest.liquidity === 'object' ? (latest.liquidity as Record<string, unknown>) : null
  const boll = latest && typeof latest.boll120 === 'object' ? (latest.boll120 as Record<string, unknown>) : null
  const eb = latest && typeof latest.equityBond === 'object' ? (latest.equityBond as Record<string, unknown>) : null
  const pxVs60 = typeof latest?.priceVsEma60 === 'number' ? (latest.priceVsEma60 as number) : NaN
  const liquidityZone = typeof liquidity?.liquidityZone === 'string' ? String(liquidity.liquidityZone) : ''
  const bwChange20 = typeof boll?.bwChangePct20d === 'number' ? (boll.bwChangePct20d as number) : NaN
  const ebPct = typeof eb?.spreadPct === 'number' ? (eb.spreadPct as number) : NaN
  const liquidityIndexNow = typeof liquidity?.liquidityIndex === 'number' ? (liquidity.liquidityIndex as number) : NaN
  const liquidityIndexDelta20 = deltaByDays(series, 20, (p) => p.v5)
  const ebPctDelta20 = deltaByDays(equityBondSeries, 20, (p) => p.pct)
  const hs300Ret20 = context?.multiPeriod?.hs300ReturnsPct && typeof (context.multiPeriod.hs300ReturnsPct as Record<string, unknown>).d20 === 'number'
    ? ((context.multiPeriod.hs300ReturnsPct as Record<string, unknown>).d20 as number)
    : null

  const timeHint = range.from && range.to ? `${range.from}~${range.to}` : '近两周'
  addQ(`A股 大盘 沪深300 走势 原因 ${timeHint} 宏观`)
  if (isFiniteNum(hs300Ret20) && hs300Ret20 <= -3) addQ(`沪深300 近一个月 下跌 原因 ${timeHint} 政策 宏观 资金面`)
  if (isFiniteNum(hs300Ret20) && hs300Ret20 >= 3) addQ(`沪深300 近一个月 上涨 原因 ${timeHint} 政策 宏观 资金面`)
  if (Number.isFinite(pxVs60) && pxVs60 < 0) addQ(`沪深300 跌破 均线 EMA60 原因 ${timeHint}`)
  if (Number.isFinite(pxVs60) && pxVs60 > 0) addQ(`沪深300 上穿 均线 趋势 改变 ${timeHint}`)
  if (liquidityZone === 'risk') addQ(`A股 流动性指数 过热 风险 北向资金 成交额 ${timeHint}`)
  if (liquidityZone === 'opportunity') addQ(`A股 流动性指数 低位 机会 北向资金 成交额 ${timeHint}`)
  if (isFiniteNum(liquidityIndexNow) && isFiniteNum(liquidityIndexDelta20) && liquidityIndexDelta20 >= 8)
    addQ(`A股 流动性指数 上升 原因 成交额 换手 北向 ${timeHint}`)
  if (isFiniteNum(liquidityIndexNow) && isFiniteNum(liquidityIndexDelta20) && liquidityIndexDelta20 <= -8)
    addQ(`A股 流动性指数 下降 原因 成交额 换手 北向 ${timeHint}`)
  addQ(`北向资金 近两周 净流入 净流出 影响 沪深300 ${timeHint}`)
  addQ(`两市 成交额 放量 缩量 原因 ${timeHint}`)
  if (Number.isFinite(bwChange20) && bwChange20 < -20) addQ(`A股 波动率 收敛 布林带 带宽 收窄 ${timeHint}`)
  if (Number.isFinite(bwChange20) && bwChange20 > 20) addQ(`A股 波动率 扩张 布林带 带宽 扩大 ${timeHint}`)
  addQ(`10年期国债收益率 近两周 变动 原因 ${timeHint}`)
  if (Number.isFinite(ebPct) && ebPct >= 70) addQ(`股债利差 高分位 A股 估值 性价比 ${timeHint}`)
  if (Number.isFinite(ebPct) && ebPct <= 30) addQ(`股债利差 低分位 A股 估值 风险 ${timeHint}`)
  if (isFiniteNum(ebPctDelta20) && ebPctDelta20 >= 10) addQ(`股债分位 上升 近一个月 原因 国债收益率 市盈率 ${timeHint}`)
  if (isFiniteNum(ebPctDelta20) && ebPctDelta20 <= -10) addQ(`股债分位 下降 近一个月 原因 国债收益率 市盈率 ${timeHint}`)
  addQ(`央行 近两周 公开市场 操作 逆回购 MLF LPR ${timeHint}`)
  addQ(`证监会 上交所 深交所 近两周 政策 监管 要点 ${timeHint}`)
  addQ(`券商 研报 A股 大盘 策略 观点 ${timeHint}`)
  addQ(`机构 观点 A股 大盘 研判 风险 偏好 ${timeHint}`)
  addQ(`知名投资者 观点 A股 大盘 市场 情绪 ${timeHint}`)
  addQ(`外资 机构 观点 北向资金 A股 ${timeHint}`)
  const searchQueries = queries.slice(0, 8)

  const notes = metaObj && Array.isArray((metaObj as Record<string, unknown>).notes) ? (metaObj as Record<string, unknown>).notes : null
  const source = metaObj && typeof (metaObj as Record<string, unknown>).source === 'string' ? String((metaObj as Record<string, unknown>).source) : null

  const developer = [
    '总是用中文回复。',
    '你是“沪深市场大盘看板”的AI解读助手，目标是帮助用户冷静决策：解释市场情绪、机会/风险、估值与流动性。',
    '请先思考再回答，但不要输出思考过程或推理草稿，只输出最终结论与可核查的引用。',
    '必须以用户提供的结构化数据为准；对不确定内容要说“不确定/暂无数据”，不要编造。',
    '你会收到 indicatorDictionary（字段含义与单位/口径）。必须在解读中尊重单位与口径，不得混用；需要换算时要说明（例如比率与%p）。',
    '输出为 Markdown，结构固定包含：概览、短线视角（明确使用的周期：近7日、5日、20日）、中线视角（明确使用的周期：60日、120日）、长线视角（明确使用的周期：252日）、流动性与资金面、估值与股债、近期资讯/关键事件、观察清单、风险提示、免责声明。',
    '当且仅当 enableWebSearch=true 时，你必须先联网检索；你会收到 search.queries（由多周期摘要与近20日变化提取趋势要素生成，含趋势强弱、波动收敛/扩张、流动性指数、股债分位区间）。请优先用这些 queries 进行检索（必要时可改写以提高召回）。',
    '在“近期资讯/关键事件”部分给出最近7-14天内与A股大盘相关的要点摘要，且每条要点必须附带可追溯 URL 与日期范围说明。',
    '在“归因总结”中把“指标信号”与“资讯证据”分开写清楚：每条归因必须说明是由哪些指标信号触发、并引用哪些来源链接支持。',
    '检索与观点来源需包含：机构、券商、知名投资者等对近期（7-14天）的市场研判与观点；引用时同样必须带 URL。',
    '短线/中线/长线的解读必须分别使用对应周期的指标汇总数据，并覆盖表格视图字段：沪深300点位、EMA20、EMA60、BOLL120（MB/UB/LB/BW）、成交额及分位、换手率及分位、北向资金净流入及分位、流动性指数及区间、股债（PE、1/PE、10Y、股债利差 value 与分位）。不得遗漏字段；若某字段缺失必须说明“暂无数据”。',
    '优先采用权威信源：交易所/监管与官方机构（上交所、深交所、证监会、央行、国家统计局等）、主流财经媒体（证券时报、中证报、上证报等）与权威门户的原文链接；避免使用无来源自媒体断言。',
    '若 enableWebSearch=true 但仍找不到可靠来源，必须明确说明“已联网检索但未获得足够可靠来源”，并给出你尝试过的2-4个检索关键词/查询方向。',
    '若 enableWebSearch=false，则“近期资讯/关键事件”必须写明“未启用联网检索，未接入新闻/事件数据”。',
    '不得给出具体买卖建议或保证性判断；必须包含“仅供参考，不构成投资建议”。',
    '尽量简洁：总长度控制在约 1200-1800 个中文字；如内容较多，优先保留结论与观察清单。',
  ].join('\n')

  const user = JSON.stringify(
    {
      request: {
        enableWebSearch,
        model,
        searchMode,
      },
      search: {
        range,
        queries: searchQueries,
        signals: {
          hs300ReturnPct20d: hs300Ret20,
          liquidityIndexNow,
          liquidityIndexDelta20d: liquidityIndexDelta20,
          bollBwChangePct20d: bwChange20,
          equityBondPctNow: ebPct,
          equityBondPctDelta20d: ebPctDelta20,
        },
      },
      market: context,
      marketNotes: notes,
      marketSource: source,
    },
    null,
    2,
  )

  const messages: Array<{ role: 'system' | 'developer' | 'user' | 'assistant'; content: string }> = [
    { role: 'developer', content: developer },
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
      enableWebSearch,
      baseUrl,
      model,
      searchMode,
      temperature: 0.4,
      maxTokens: 2600,
      ...(maxCompletionTokens ? { maxCompletionTokens } : {}),
      ...(extraBody ? { extraBody } : {}),
      stream: true,
    },
    search: {
      range,
      queries: searchQueries,
      signals: {
        hs300ReturnPct20d: hs300Ret20,
        liquidityIndexNow,
        liquidityIndexDelta20d: liquidityIndexDelta20,
        bollBwChangePct20d: bwChange20,
        equityBondPctNow: ebPct,
        equityBondPctDelta20d: ebPctDelta20,
      },
    },
    prompts: {
      developer,
      user,
    },
  })

  try {
    await aihubmixChatCompletionsToSseEvents({
      baseUrl,
      apiKey,
      model,
      messages,
      temperature: 0.4,
      maxTokens: 2600,
      ...(maxCompletionTokens ? { maxCompletionTokens } : {}),
      ...(extraBody ? { extraBody } : {}),
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
