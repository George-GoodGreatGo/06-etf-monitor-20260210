import { fetchEastmoneyDailyKline, fetchEastmoneyDailyKlineWithAmount } from './eastmoneyKline.js'
import { fetchLowVolIndexCloseSeries } from './lowVol.js'
import { runAkshare } from './akshare.js'
import { readRpsStyleMeta, readRpsStylePointsRange, type RpsStylePointRow } from './supabaseRest.js'

type CacheEntry<T> = { expiresAt: number; value: T }
const readCache = new Map<string, CacheEntry<unknown>>()
const readInflight = new Map<string, Promise<unknown>>()
const READ_CACHE_TTL_MS = 5 * 60_000
const RPS_CUSTOM_QUERY_CACHE_VERSION = 'v5'
const RPS_ETF_NAME_HTTP_CACHE_VERSION = 'v1'
const RPS_ETF_NAME_HTTP_SUCCESS_TTL_MS = 6 * 60 * 60_000
const RPS_ETF_NAME_HTTP_FAILURE_TTL_MS = 30_000
const EASTMONEY_SUGGEST_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'
const ETF_NAME_LOOKUP_EMPTY_SENTINEL = '__EMPTY__'
const SHANGHAI_TRADE_DAY_COMPLETE_CUTOFF_MINUTES = 15 * 60 + 30

export const RPS_BENCHMARK_TICKER = 'H30269'
export const RPS_BENCHMARK_NAME = '红利低波全收益指数'
export const RPS_TARGET_TICKERS = ['159915.SZ', '588000.SH', '513180.SH', '510300.SH', '512050.SH', '560010.SH'] as const
const RPS_RUN_STALE_MAX_DAYS = 14
const RPS_TURNOVER_LOOKBACK_DAYS = 20
const RPS_TURNOVER_DISPLAY_DAYS = 90
const RPS_CUSTOM_QUERY_TURNOVER_DISPLAY_DAYS = 250
const RPS_TURNOVER_FETCH_CALENDAR_DAYS = 540

type DataSourceName = 'eastmoney:qfq' | 'akshare:qfq'

export type RpsBenchmarkIndexInfo = {
  code: string
  name: string
}

export type RpsTickerProfile = {
  ticker: string
  code: string
  name: string
  benchmarkIndex: RpsBenchmarkIndexInfo
}

export type RpsBenchmarkMeta = {
  ticker: string
  name: string
}

const RPS_BENCHMARK_META: RpsBenchmarkMeta = {
  ticker: RPS_BENCHMARK_TICKER,
  name: RPS_BENCHMARK_NAME,
}

const RPS_TICKER_PROFILES: Record<string, RpsTickerProfile> = {
  '512890.SH': {
    ticker: '512890.SH',
    code: '512890',
    name: '红利低波ETF',
    benchmarkIndex: { code: 'H30269', name: '红利低波全收益指数' },
  },
  '159915.SZ': {
    ticker: '159915.SZ',
    code: '159915',
    name: '创业板ETF',
    benchmarkIndex: { code: '399006.SZ', name: '创业板指数' },
  },
  '588000.SH': {
    ticker: '588000.SH',
    code: '588000',
    name: '科创50ETF',
    benchmarkIndex: { code: '000688.SH', name: '科创50指数' },
  },
  '513180.SH': {
    ticker: '513180.SH',
    code: '513180',
    name: '恒生科技ETF',
    benchmarkIndex: { code: 'HSTECH.HI', name: '恒生科技指数' },
  },
  '510300.SH': {
    ticker: '510300.SH',
    code: '510300',
    name: '沪深300ETF',
    benchmarkIndex: { code: '000300.SH', name: '沪深300指数' },
  },
  '512050.SH': {
    ticker: '512050.SH',
    code: '512050',
    name: '中证A500ETF',
    benchmarkIndex: { code: '000510.CSI', name: '中证A500指数' },
  },
  '560010.SH': {
    ticker: '560010.SH',
    code: '560010',
    name: '中证1000ETF',
    benchmarkIndex: { code: '000852.SH', name: '中证1000指数' },
  },
}

function readCacheGet<T>(key: string): T | null {
  const hit = readCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value as T
  return null
}

function readCacheSet<T>(key: string, value: T, ttlMs = READ_CACHE_TTL_MS) {
  readCache.set(key, { expiresAt: Date.now() + ttlMs, value })
}

async function readCacheRemember<T>(key: string, task: () => Promise<T>, ttlMs = READ_CACHE_TTL_MS): Promise<T> {
  const hit = readCacheGet<T>(key)
  if (hit != null) return hit
  const inflight = readInflight.get(key)
  if (inflight) return inflight as Promise<T>
  const p = (async () => {
    const out = await task()
    readCacheSet(key, out, ttlMs)
    return out
  })().finally(() => {
    readInflight.delete(key)
  })
  readInflight.set(key, p as Promise<unknown>)
  return p
}

export type RpsComputedPoint = {
  date: string
  ticker: string
  benchmarkTicker: string
  targetCloseQfq: number
  benchmarkCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
}

export type RpsCustomQueryLatest = {
  date: string
  targetCloseQfq: number
  benchmarkCloseQfq: number
  rpsRaw: number
  rpsMa50: number | null
  scorePct: number | null
}

export type RpsLatestTurnoverSummary = {
  date: string
  turnover: number | null
  turnoverMultipleOfPrev20Avg: number | null
  turnoverChangePct1d: number | null
  turnoverChangePct7dAvg: number | null
  z90: number | null
  dataStatus: 'complete' | 'incomplete'
}

export type RpsCustomQuerySummary = {
  inputTicker: string
  ticker: string
  code: string
  name: string
  benchmarkTicker: string
  benchmarkName: string
  latest: RpsCustomQueryLatest | null
  latestTurnoverSummary: RpsLatestTurnoverSummary | null
}

export type RpsCustomQueryResult = {
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    isFallback: boolean
  }
  data: {
    summary: RpsCustomQuerySummary
    inputTicker: string
    ticker: string
    code: string
    name: string
    benchmarkTicker: string
    benchmarkName: string
    latest: RpsCustomQueryLatest | null
    latestTurnoverSummary: RpsLatestTurnoverSummary | null
    series: RpsComputedPoint[]
    turnoverSeries: RpsTurnoverHistoryPoint[]
  }
}

export type RpsSignalSeriesResult = {
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    isFallback: boolean
  }
  data: {
    inputTicker: string
    ticker: string
    code: string
    name: string
    benchmarkTicker: string
    benchmarkName: string
    latest: RpsCustomQueryLatest | null
    series: RpsComputedPoint[]
  }
}

export type RpsStyleSeriesResult = {
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    sourceType: 'supabase-table'
    snapshotAt: string | null
    stale: boolean
    isFallback: boolean
  }
  data: {
    ticker: string
    benchmarkTicker: string
    benchmarkName: string
    series: RpsComputedPoint[]
  }
}

function normalizeYmd10(raw: unknown): string {
  const s = String(raw || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return ''
}

function ymd10ToUtcMs(ymd10: string): number | null {
  const s = String(ymd10 || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const ms = Date.UTC(y, m - 1, d)
  return Number.isFinite(ms) ? ms : null
}

function diffDaysUtc(aYmd10: string, bYmd10: string): number | null {
  const a = ymd10ToUtcMs(aYmd10)
  const b = ymd10ToUtcMs(bYmd10)
  if (a == null || b == null) return null
  return Math.floor((a - b) / 86_400_000)
}

function ymd8(ymd10: string): string {
  const s = normalizeYmd10(ymd10)
  return s ? s.replace(/-/g, '') : ''
}

function shiftYmd10Days(ymd10Raw: string, offsetDays: number): string {
  const baseMs = ymd10ToUtcMs(normalizeYmd10(ymd10Raw))
  if (baseMs == null) return ''
  return new Date(baseMs + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** Math.max(0, digits)
  return Math.round(value * factor) / factor
}

function getShanghaiNowContext(now = new Date()): { date: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || ''
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  const hour = Number(pick('hour'))
  const minute = Number(pick('minute'))
  return {
    date: `${year}-${month}-${day}`,
    minutesOfDay: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  }
}

function resolveLatestCompleteTradingDate(dates: string[], now = new Date()): string | null {
  const normalized = Array.from(new Set(dates.map(normalizeYmd10).filter(Boolean))).sort()
  if (!normalized.length) return null
  const latest = normalized[normalized.length - 1]
  const shanghaiNow = getShanghaiNowContext(now)
  if (latest === shanghaiNow.date && shanghaiNow.minutesOfDay < SHANGHAI_TRADE_DAY_COMPLETE_CUTOFF_MINUTES) {
    return normalized.length >= 2 ? normalized[normalized.length - 2] : null
  }
  return latest
}

function clipSeriesToInclusiveEndDate<T extends { date: string }>(series: T[], endDate: string | null): T[] {
  const normalizedEndDate = normalizeYmd10(endDate)
  if (!normalizedEndDate) return []
  return series.filter((item) => {
    const date = normalizeYmd10(item.date)
    return Boolean(date) && date <= normalizedEndDate
  })
}

function resolveSharedLatestCompleteTradingDate(args: {
  rpsSeries: Array<{ date: string }>
  turnoverSeries: Array<{ date: string }>
  now?: Date
}): string | null {
  const latestRpsDate = resolveLatestCompleteTradingDate(
    args.rpsSeries.map((item) => item.date),
    args.now,
  )
  const latestTurnoverDate = resolveLatestCompleteTradingDate(
    args.turnoverSeries.map((item) => item.date),
    args.now,
  )
  if (latestRpsDate && latestTurnoverDate) return latestRpsDate <= latestTurnoverDate ? latestRpsDate : latestTurnoverDate
  return latestRpsDate || latestTurnoverDate || null
}

function badRequest(message: string): never {
  throw new Error(`bad_request:${message}`)
}

function noData(message: string): never {
  throw new Error(`no_data:${message}`)
}

function buildSma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null)
  if (!values.length || period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastErr: unknown = null
  for (let i = 0; i <= retries; i += 1) {
    try {
      if (i > 0) await sleep(250 * i + Math.floor(Math.random() * 200))
      return await fn()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function tickerToSecid(ticker: string): string {
  const t = String(ticker || '').trim().toUpperCase()
  const [code, ex] = t.split('.')
  if (!/^\d{6}$/.test(code)) throw new Error(`bad ticker code: ${ticker}`)
  if (ex === 'SH') return `1.${code}`
  if (ex === 'SZ') return `0.${code}`
  throw new Error(`bad ticker exchange: ${ticker}`)
}

function tickerToCode(ticker: string): string {
  const t = String(ticker || '').trim().toUpperCase()
  const [code] = t.split('.')
  if (!/^\d{6}$/.test(code)) throw new Error(`bad ticker: ${ticker}`)
  return code
}

async function fetchQfqDailyByEastmoney(args: {
  ticker: string
  startDate: string
  endDate: string
}): Promise<Array<{ date: string; close: number }>> {
  const secid = tickerToSecid(args.ticker)
  const beg = ymd8(args.startDate)
  const end = ymd8(args.endDate)
  if (!beg || !end) return []
  const rows = await fetchEastmoneyDailyKline({ secid, beg, end })
  const out: Array<{ date: string; close: number }> = []
  for (const r of rows) {
    const d = normalizeYmd10(r.date)
    const c = typeof r.close === 'number' && Number.isFinite(r.close) ? r.close : null
    if (!d || c == null) continue
    out.push({ date: d, close: c })
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

async function fetchQfqDailyByAkshare(args: {
  ticker: string
  startDate: string
  endDate: string
}): Promise<Array<{ date: string; close: number }>> {
  const code = tickerToCode(args.ticker)
  const start8 = ymd8(args.startDate)
  const end8 = ymd8(args.endDate)
  const cacheKey = `rps:qfq:${code}:${start8}:${end8}`
  const out = await runAkshare<{ series?: Array<{ date?: string; close?: number | null }> }>(
    cacheKey,
    ['rps-qfq', '--ticker', code, '--start-date', start8, '--end-date', end8],
    { cacheTtlMs: 30 * 60_000, timeoutMs: 120_000 },
  )
  if (out.success !== true) throw new Error(out.message || 'akshare qfq failed')
  const rows = Array.isArray(out.data?.series) ? out.data.series : []
  const series: Array<{ date: string; close: number }> = []
  for (const r of rows) {
    const d = normalizeYmd10(r?.date)
    const c = typeof r?.close === 'number' && Number.isFinite(r.close) ? r.close : null
    if (!d || c == null) continue
    series.push({ date: d, close: c })
  }
  series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return series
}

async function fetchQfqDailyWithFallback(args: {
  ticker: string
  startDate: string
  endDate: string
  extraRetries?: number
}): Promise<{ source: DataSourceName; series: Array<{ date: string; close: number }> }> {
  const extra = Math.max(0, Number(args.extraRetries || 0))
  let eastErr = ''
  try {
    const east = await withRetry(() => fetchQfqDailyByEastmoney(args), 2 + extra)
    if (east.length > 0) return { source: 'eastmoney:qfq', series: east }
    throw new Error('eastmoney empty')
  } catch (e) {
    eastErr = e instanceof Error ? e.message : String(e)
  }
  try {
    const ak = await withRetry(() => fetchQfqDailyByAkshare(args), 2 + extra)
    if (ak.length > 0) return { source: 'akshare:qfq', series: ak }
    throw new Error('akshare empty')
  } catch (e) {
    const akErr = e instanceof Error ? e.message : String(e)
    throw new Error(`qfq failed: ${args.ticker}; eastmoney=${eastErr || 'unknown'}; akshare=${akErr || 'unknown'}`)
  }
}

async function fetchBenchmarkDailySeries(args: {
  startDate: string
  endDate: string
}): Promise<{ source: 'csindex:index' | 'cnindex:index'; series: Array<{ date: string; close: number }> }> {
  const beg = ymd8(args.startDate)
  const end = ymd8(args.endDate)
  if (!beg || !end) return { source: 'csindex:index', series: [] }
  const rows = await fetchLowVolIndexCloseSeries({
    code: RPS_BENCHMARK_TICKER,
    kind: 'pri',
    startDate8: beg,
    endDate8: end,
  })
  const series = rows
    .map((row) => {
      const date = normalizeYmd10(row.date)
      const close = typeof row.close === 'number' && Number.isFinite(row.close) ? row.close : null
      return date && close != null ? { date, close } : null
    })
    .filter((row): row is { date: string; close: number } => Boolean(row))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (!series.length) {
    throw new Error(`benchmark index series empty: ${RPS_BENCHMARK_TICKER}`)
  }
  return { source: 'csindex:index', series }
}

function getTickerProfileOrThrow(tickerRaw: string): RpsTickerProfile {
  const ticker = String(tickerRaw || '').trim().toUpperCase()
  const profile = RPS_TICKER_PROFILES[ticker]
  if (!profile) throw new Error(`不支持的 ticker：${ticker}`)
  return profile
}

export function normalizeRpsCustomTickerInput(tickerRaw: string): string {
  const raw = String(tickerRaw || '').trim().toUpperCase()
  if (!raw) badRequest('请输入ETF代码')
  if (/^\d{6}\.(SH|SZ)$/.test(raw)) return raw
  if (/^(SH|SZ)\d{6}$/.test(raw)) return `${raw.slice(2)}.${raw.slice(0, 2)}`
  if (/^\d{6}$/.test(raw)) {
    const first = raw[0]
    if (first === '5' || first === '6' || first === '9') return `${raw}.SH`
    if (first === '0' || first === '1' || first === '2' || first === '3') return `${raw}.SZ`
  }
  badRequest(`ETF代码格式无效：${raw}`)
}

type RpsCustomTickerNameSource = 'preset' | 'eastmoney_http' | 'fallback_code'

type EastmoneySuggestRow = {
  Code?: string
  Name?: string
}

function normalizeEtfNameCandidate(nameRaw: unknown, code: string): string | null {
  const name = String(nameRaw || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return null
  const upper = name.toUpperCase()
  if (name === code || upper === code) return null
  if (upper === `ETF ${code}` || upper === `ETF${code}`) return null
  return name
}

function buildEtfNameHttpCacheKey(code: string): string {
  return `rps:custom:etf-name-http:${RPS_ETF_NAME_HTTP_CACHE_VERSION}:${code}`
}

export function buildRpsCustomQueryCacheKey(ticker: string, startDate: string, endDate: string): string {
  return `rps:custom:${RPS_CUSTOM_QUERY_CACHE_VERSION}:${ticker}:${startDate}:${endDate}`
}

function pickEtfNameFromEastmoneySuggestPayload(payload: unknown, code: string): string | null {
  const rows =
    payload &&
    typeof payload === 'object' &&
    'QuotationCodeTable' in payload &&
    (payload as { QuotationCodeTable?: { Data?: unknown } }).QuotationCodeTable &&
    Array.isArray((payload as { QuotationCodeTable?: { Data?: unknown[] } }).QuotationCodeTable?.Data)
      ? ((payload as { QuotationCodeTable?: { Data?: EastmoneySuggestRow[] } }).QuotationCodeTable?.Data ?? [])
      : []
  for (const row of rows) {
    if (String(row?.Code || '').trim() !== code) continue
    const name = normalizeEtfNameCandidate(row?.Name, code)
    if (name) return name
  }
  return null
}

async function fetchEtfNameByEastmoneySuggest(
  code: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<string | null> {
  const fetchImpl = opts?.fetchImpl ?? fetch
  const url = new URL('https://searchapi.eastmoney.com/api/suggest/get')
  url.searchParams.set('input', code)
  url.searchParams.set('type', '14')
  url.searchParams.set('token', EASTMONEY_SUGGEST_TOKEN)
  const res = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://quote.eastmoney.com/',
    },
  })
  if (!res.ok) throw new Error(`eastmoney_etf_name_http_${res.status}`)
  const payload = (await res.json()) as unknown
  return pickEtfNameFromEastmoneySuggestPayload(payload, code)
}

async function resolveEtfNameFromHttp(code: string): Promise<string | null> {
  const cacheKey = buildEtfNameHttpCacheKey(code)
  const cached = readCacheGet<string>(cacheKey)
  if (cached != null) return cached === ETF_NAME_LOOKUP_EMPTY_SENTINEL ? null : cached
  try {
    const cachedName = await readCacheRemember(
      cacheKey,
      async () => {
        const resolved = normalizeEtfNameCandidate(await withRetry(() => fetchEtfNameByEastmoneySuggest(code), 1), code)
        return resolved ?? ETF_NAME_LOOKUP_EMPTY_SENTINEL
      },
      RPS_ETF_NAME_HTTP_SUCCESS_TTL_MS,
    )
    return cachedName === ETF_NAME_LOOKUP_EMPTY_SENTINEL ? null : cachedName
  } catch {
    readCacheSet(cacheKey, ETF_NAME_LOOKUP_EMPTY_SENTINEL, RPS_ETF_NAME_HTTP_FAILURE_TTL_MS)
    return null
  }
}

export async function resolveRpsCustomTickerProfile(
  tickerRaw: string,
  opts?: { resolveEtfNameByCode?: (code: string) => Promise<string | null> },
): Promise<Pick<RpsTickerProfile, 'ticker' | 'code' | 'name'> & { nameSource: RpsCustomTickerNameSource }> {
  const ticker = normalizeRpsCustomTickerInput(tickerRaw)
  const profile = RPS_TICKER_PROFILES[ticker]
  if (profile) return { ...profile, nameSource: 'preset' }
  const code = tickerToCode(ticker)
  const resolveName = opts?.resolveEtfNameByCode ?? resolveEtfNameFromHttp
  const resolvedName = normalizeEtfNameCandidate(await resolveName(code), code)
  return {
    ticker,
    code,
    name: resolvedName ?? code,
    nameSource: resolvedName ? 'eastmoney_http' : 'fallback_code',
  }
}

export function __resetRpsStyleReadCacheForTest() {
  readCache.clear()
  readInflight.clear()
}

export function __deleteRpsStyleReadCacheForTest(key: string) {
  readCache.delete(key)
  readInflight.delete(key)
}

export function __pickEtfNameFromEastmoneySuggestPayloadForTest(payload: unknown, code: string): string | null {
  return pickEtfNameFromEastmoneySuggestPayload(payload, code)
}

export async function __fetchEtfNameByEastmoneySuggestForTest(
  code: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<string | null> {
  return await fetchEtfNameByEastmoneySuggest(code, opts)
}

export function __buildEtfNameHttpCacheKeyForTest(code: string): string {
  return buildEtfNameHttpCacheKey(code)
}

export function __resolveLatestCompleteTradingDateForTest(dates: string[], now: Date): string | null {
  return resolveLatestCompleteTradingDate(dates, now)
}

export function __resolveSharedLatestCompleteTradingDateForTest(args: {
  rpsSeries: Array<{ date: string }>
  turnoverSeries: Array<{ date: string }>
  now: Date
}): string | null {
  return resolveSharedLatestCompleteTradingDate(args)
}

export function __clipSeriesToInclusiveEndDateForTest<T extends { date: string }>(series: T[], endDate: string | null): T[] {
  return clipSeriesToInclusiveEndDate(series, endDate)
}

export type RpsTurnoverHistoryPoint = {
  date: string
  turnover: number | null
  turnoverMultipleOfPrev20Avg: number | null
}

export type RpsTurnoverSummaryItem = {
  ticker: string
  code: string
  name: string
  latestTradingDate: string | null
  latestAmplifiedDate: string | null
  tradingDaysAgo: number | null
  status: 'hit' | 'no_signal' | 'no_data'
}

export function buildRpsTurnoverHistory(
  rows: Array<{ date: string; turnover: number | null }>,
  opts?: { lookbackDays?: number; displayDays?: number },
): RpsTurnoverHistoryPoint[] {
  const lookbackDays = Math.max(1, Math.floor(opts?.lookbackDays ?? RPS_TURNOVER_LOOKBACK_DAYS))
  const displayDays = Math.max(1, Math.floor(opts?.displayDays ?? RPS_TURNOVER_DISPLAY_DAYS))
  const normalized = rows
    .map((row) => {
      const date = normalizeYmd10(row.date)
      const turnover = typeof row.turnover === 'number' && Number.isFinite(row.turnover) && row.turnover >= 0 ? row.turnover : null
      return { date, turnover }
    })
    .filter((row) => row.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const out: RpsTurnoverHistoryPoint[] = normalized.map((row, index) => {
    const prevWindow = normalized.slice(Math.max(0, index - lookbackDays), index)
    const hasFullWindow = prevWindow.length === lookbackDays && prevWindow.every((item) => typeof item.turnover === 'number')
    let turnoverMultipleOfPrev20Avg: number | null = null
    if (hasFullWindow && typeof row.turnover === 'number') {
      const avg = prevWindow.reduce((sum, item) => sum + (item.turnover as number), 0) / lookbackDays
      if (avg > 0) turnoverMultipleOfPrev20Avg = roundTo(row.turnover / avg, 2)
    }
    return {
      date: row.date,
      turnover: row.turnover,
      turnoverMultipleOfPrev20Avg,
    }
  })

  return out.slice(-displayDays)
}

export function buildRpsTurnoverSummaryItem(
  profile: Pick<RpsTickerProfile, 'ticker' | 'code' | 'name'>,
  history: RpsTurnoverHistoryPoint[],
  threshold = 1.5,
): RpsTurnoverSummaryItem {
  const latestTradingDate = history.length ? history[history.length - 1].date : null
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const point = history[index]
    if (typeof point.turnoverMultipleOfPrev20Avg === 'number' && point.turnoverMultipleOfPrev20Avg >= threshold) {
      return {
        ticker: profile.ticker,
        code: profile.code,
        name: profile.name,
        latestTradingDate,
        latestAmplifiedDate: point.date,
        tradingDaysAgo: history.length - 1 - index,
        status: 'hit',
      }
    }
  }

  return {
    ticker: profile.ticker,
    code: profile.code,
    name: profile.name,
    latestTradingDate,
    latestAmplifiedDate: null,
    tradingDaysAgo: null,
    status: history.length ? 'no_signal' : 'no_data',
  }
}

export function buildRpsLatestTurnoverSummary(history: RpsTurnoverHistoryPoint[]): RpsLatestTurnoverSummary | null {
  const latest = history.length ? history[history.length - 1] : null
  if (!latest) return null
  const previous = history.length >= 2 ? history[history.length - 2] : null
  const previousTurnover =
    previous && typeof previous.turnover === 'number' && Number.isFinite(previous.turnover) ? previous.turnover : null
  const latestTurnover = typeof latest.turnover === 'number' && Number.isFinite(latest.turnover) ? latest.turnover : null
  let turnoverChangePct1d: number | null = null
  if (latestTurnover != null && previousTurnover != null && previousTurnover !== 0) {
    turnoverChangePct1d = roundTo((latestTurnover / previousTurnover - 1) * 100, 2)
  }

  let turnoverChangePct7dAvg: number | null = null
  if (history.length >= 8 && latestTurnover != null) {
    const window = history
      .slice(history.length - 8, history.length - 1)
      .map((point) => point.turnover)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    if (window.length === 7) {
      const avg7 = window.reduce((sum, value) => sum + value, 0) / 7
      if (avg7 !== 0) turnoverChangePct7dAvg = roundTo((latestTurnover / avg7 - 1) * 100, 2)
    }
  }

  let z90: number | null = null
  if (history.length >= 91 && latestTurnover != null) {
    const hist90 = history
      .slice(history.length - 91, history.length - 1)
      .map((point) => point.turnover)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    if (hist90.length === 90) {
      const mean = hist90.reduce((sum, value) => sum + value, 0) / 90
      const variance = hist90.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 90
      const std = Math.sqrt(variance)
      if (std !== 0) z90 = roundTo((latestTurnover - mean) / std, 4)
    }
  }

  return {
    date: latest.date,
    turnover: latestTurnover,
    turnoverMultipleOfPrev20Avg: latest.turnoverMultipleOfPrev20Avg,
    turnoverChangePct1d,
    turnoverChangePct7dAvg,
    z90,
    dataStatus: latestTurnover != null && z90 != null ? 'complete' : 'incomplete',
  }
}

export function buildRpsComputedSeries(args: {
  ticker: string
  benchmarkTicker: string
  targetSeries: Array<{ date: string; close: number }>
  benchmarkSeries: Array<{ date: string; close: number }>
  maPeriod?: number
}): RpsComputedPoint[] {
  const benchmarkMap = new Map<string, number>()
  for (const point of args.benchmarkSeries) {
    if (typeof point.close === 'number' && Number.isFinite(point.close) && point.close > 0) {
      benchmarkMap.set(point.date, point.close)
    }
  }
  const aligned: Array<{ date: string; targetClose: number; benchmarkClose: number; rpsRaw: number }> = []
  for (const point of args.targetSeries) {
    if (typeof point.close !== 'number' || !Number.isFinite(point.close)) continue
    const benchmarkClose = benchmarkMap.get(point.date)
    if (typeof benchmarkClose !== 'number' || !Number.isFinite(benchmarkClose) || benchmarkClose <= 0) continue
    const rpsRaw = point.close / benchmarkClose
    if (!Number.isFinite(rpsRaw)) continue
    aligned.push({
      date: point.date,
      targetClose: point.close,
      benchmarkClose,
      rpsRaw,
    })
  }
  aligned.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const maPeriod = Math.max(1, Math.floor(args.maPeriod ?? 50))
  const ma50 = buildSma(
    aligned.map((point) => point.rpsRaw),
    maPeriod,
  )
  return aligned.map((point, index) => {
    const ma = ma50[index]
    const scorePct = typeof ma === 'number' && Number.isFinite(ma) && ma !== 0 ? ((point.rpsRaw / ma - 1) * 100) : null
    return {
      date: point.date,
      ticker: args.ticker,
      benchmarkTicker: args.benchmarkTicker,
      targetCloseQfq: point.targetClose,
      benchmarkCloseQfq: point.benchmarkClose,
      rpsRaw: point.rpsRaw,
      rpsMa50: ma,
      scorePct,
    }
  })
}

async function fetchRpsTurnoverSeries(args: {
  ticker: string
  endDate: string
}): Promise<{ source: 'eastmoney:kline'; series: Array<{ date: string; turnover: number | null }> }> {
  const secid = tickerToSecid(args.ticker)
  const endDate = normalizeYmd10(args.endDate)
  const startDate = shiftYmd10Days(endDate, -RPS_TURNOVER_FETCH_CALENDAR_DAYS)
  const rows = await fetchEastmoneyDailyKlineWithAmount({
    secid,
    beg: ymd8(startDate),
    end: ymd8(endDate),
  })
  const series = rows
    .map((row) => ({
      date: normalizeYmd10(row.date),
      turnover: typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : null,
    }))
    .filter((row) => row.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  if (!series.length) throw new Error(`RPS 成交额历史为空：${args.ticker}`)
  return { source: 'eastmoney:kline', series }
}

async function computeRpsSeriesForTicker(args: {
  ticker: string
  startDate: string
  endDate: string
  extraRetries?: number
}): Promise<{
  benchmarkTicker: string
  benchmarkName: string
  benchmarkSource: string
  targetSource: DataSourceName
  series: RpsComputedPoint[]
}> {
  const [benchmark, target] = await Promise.all([
    fetchBenchmarkDailySeries({ startDate: args.startDate, endDate: args.endDate }),
    fetchQfqDailyWithFallback({
      ticker: args.ticker,
      startDate: args.startDate,
      endDate: args.endDate,
      extraRetries: args.extraRetries,
    }),
  ])
  const series = buildRpsComputedSeries({
    ticker: args.ticker,
    benchmarkTicker: RPS_BENCHMARK_TICKER,
    targetSeries: target.series,
    benchmarkSeries: benchmark.series,
  })
  if (!series.length) noData(`未获取到可用于计算RPS的历史数据：${args.ticker}`)
  return {
    benchmarkTicker: RPS_BENCHMARK_TICKER,
    benchmarkName: RPS_BENCHMARK_NAME,
    benchmarkSource: benchmark.source,
    targetSource: target.source,
    series,
  }
}

function mapPointRowToComputedPoint(r: RpsStylePointRow): RpsComputedPoint {
  return {
    date: r.data_date,
    ticker: r.ticker,
    benchmarkTicker: r.benchmark_ticker,
    targetCloseQfq: r.target_close_qfq,
    benchmarkCloseQfq: r.benchmark_close_qfq,
    rpsRaw: r.rps_raw,
    rpsMa50: r.rps_ma50 ?? null,
    scorePct: r.score_pct ?? null,
  }
}

function validateRows(rows: RpsStylePointRow[]): { ok: true } | { ok: false; error: string } {
  if (!rows.length) return { ok: false, error: 'empty' }
  let prev = ''
  let nonInc = 0
  let dup = 0
  let valid = 0
  const seen = new Set<string>()
  for (const r of rows) {
    const d = String(r.data_date || '')
    if (!d) continue
    if (seen.has(d)) dup += 1
    seen.add(d)
    if (prev && d <= prev) nonInc += 1
    prev = d
    if (
      typeof r.target_close_qfq === 'number' &&
      Number.isFinite(r.target_close_qfq) &&
      typeof r.benchmark_close_qfq === 'number' &&
      Number.isFinite(r.benchmark_close_qfq) &&
      typeof r.rps_raw === 'number' &&
      Number.isFinite(r.rps_raw)
    ) {
      valid += 1
    }
  }
  if (dup > 0 || nonInc > 0) return { ok: false, error: `bad_date_series(dup=${dup},nonInc=${nonInc})` }
  if (valid === 0) return { ok: false, error: 'no_valid_points' }
  return { ok: true }
}

async function getSeriesFromSupabaseRuns(args: {
  ticker: string
  startDate?: string
  endDate?: string
}): Promise<{
  usedRunId: string | null
  fallbackReason: string | null
  fetchedAt: string
  dataDate: string | null
  notes: string[]
  series: RpsComputedPoint[]
}> {
  const ticker = String(args.ticker || '').trim().toUpperCase()
  const startYmd = normalizeYmd10(args.startDate) || '2016-01-01'
  const endYmd = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const meta = await readRpsStyleMeta()
  const candidates = (meta?.historyRunIds || []).filter(Boolean)
  if (candidates.length === 0) throw new Error(`暂无可用 RPS run：${ticker}`)

  let fallbackReason: string | null = null
  for (const runId of candidates) {
    const rows = await readRpsStylePointsRange({ ticker, startDate: startYmd, endDate: endYmd, runId })
    if (!rows.length) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:empty` : `run=${runId}:empty`
      continue
    }
    const v = validateRows(rows)
    if ('error' in v) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:${v.error}` : `run=${runId}:${v.error}`
      continue
    }
    const lastDate = rows[rows.length - 1]?.data_date || ''
    const lag = lastDate ? diffDaysUtc(endYmd, lastDate) : null
    if (lag != null && lag > RPS_RUN_STALE_MAX_DAYS) {
      fallbackReason = fallbackReason ? `${fallbackReason}; run=${runId}:stale(${lag}d)` : `run=${runId}:stale(${lag}d)`
      continue
    }
    return {
      usedRunId: runId,
      fallbackReason,
      fetchedAt: rows[rows.length - 1]?.fetched_at || new Date().toISOString(),
      dataDate: lastDate || null,
      notes: Array.isArray(rows[rows.length - 1]?.notes) ? (rows[rows.length - 1].notes as string[]) : [],
      series: rows.map(mapPointRowToComputedPoint),
    }
  }
  throw new Error(`暂无可用 RPS 数据：${ticker}${fallbackReason ? `（${fallbackReason}）` : ''}`)
}

export function getRpsStyleSupportedTickers(): string[] {
  return [...RPS_TARGET_TICKERS]
}

export function getRpsStyleTurnoverSupportedTickers(): string[] {
  return Object.keys(RPS_TICKER_PROFILES)
}

export function getRpsStyleBenchmarkMeta(): RpsBenchmarkMeta {
  return { ...RPS_BENCHMARK_META }
}

export function getRpsStyleComputationNotes(): string[] {
  return [
    `RPS=目标ETF前复权收盘价/${RPS_BENCHMARK_TICKER}收盘点位`,
    'MA50=RPS 50日简单均线',
    'Score=(RPS/MA50-1)*100%',
    `benchmark=${RPS_BENCHMARK_TICKER} ${RPS_BENCHMARK_NAME}`,
  ]
}

export async function computeRpsStyleDataset(args: {
  startDate: string
  endDate: string
}): Promise<{
  benchmarkTicker: string
  benchmarkName: string
  benchmarkSource: string
  tickerSources: Record<string, DataSourceName>
  seriesByTicker: Record<string, RpsComputedPoint[]>
  dataDate: string | null
}> {
  const startDate = normalizeYmd10(args.startDate)
  const endDate = normalizeYmd10(args.endDate)
  if (!startDate || !endDate) throw new Error('bad date range')

  const bmk = await fetchBenchmarkDailySeries({ startDate, endDate })
  const benchmarkMap = new Map<string, number>()
  for (const p of bmk.series) benchmarkMap.set(p.date, p.close)

  const seriesByTicker: Record<string, RpsComputedPoint[]> = {}
  const tickerSources: Record<string, DataSourceName> = {}
  let globalMaxDate: string | null = null

  for (const ticker of RPS_TARGET_TICKERS) {
    const out = await fetchQfqDailyWithFallback({ ticker, startDate, endDate })
    tickerSources[ticker] = out.source
    const points = buildRpsComputedSeries({
      ticker,
      benchmarkTicker: RPS_BENCHMARK_TICKER,
      targetSeries: out.series,
      benchmarkSeries: bmk.series,
    })
    if (!points.length) throw new Error(`RPS 数据为空：${ticker}`)
    const lastDate = points[points.length - 1]?.date || null
    if (lastDate && (!globalMaxDate || lastDate > globalMaxDate)) globalMaxDate = lastDate
    seriesByTicker[ticker] = points
  }

  return {
    benchmarkTicker: RPS_BENCHMARK_TICKER,
    benchmarkName: RPS_BENCHMARK_NAME,
    benchmarkSource: bmk.source,
    tickerSources,
    seriesByTicker,
    dataDate: globalMaxDate,
  }
}

export async function getRpsStyleSeries(args: {
  ticker: string
  startDate?: string
  endDate?: string
}): Promise<RpsStyleSeriesResult> {
  const ticker = String(args.ticker || '').trim().toUpperCase()
  if (!RPS_TARGET_TICKERS.includes(ticker as (typeof RPS_TARGET_TICKERS)[number])) {
    throw new Error(`不支持的 ticker：${ticker}`)
  }
  const startYmd = normalizeYmd10(args.startDate)
  const endYmd = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const cacheKey = `rps:series:${ticker}:${startYmd || 'na'}:${endYmd}`
  return await readCacheRemember(cacheKey, async () => {
    const out = await getSeriesFromSupabaseRuns({ ticker, startDate: args.startDate, endDate: args.endDate })
    const meta = await readRpsStyleMeta()
    const isFallback = Boolean(out.usedRunId && meta?.currentRunId && out.usedRunId !== meta.currentRunId)
    return {
      meta: {
        fetchedAt: out.fetchedAt,
        dataDate: out.dataDate,
        source: 'supabase:rps_style_point',
        notes: [...out.notes, ...(out.usedRunId ? [`run_id=${out.usedRunId}`] : []), ...(out.fallbackReason ? [`run_fallback=${out.fallbackReason}`] : [])],
        sourceType: 'supabase-table',
        snapshotAt: out.fetchedAt,
        stale: false,
        isFallback,
      },
      data: {
        ticker,
        benchmarkTicker: RPS_BENCHMARK_TICKER,
        benchmarkName: RPS_BENCHMARK_NAME,
        series: out.series,
      },
    }
  })
}

export async function getRpsStyleTurnoverHistory(args: {
  ticker: string
}): Promise<{
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    isFallback: boolean
  }
  data: {
    ticker: string
    code: string
    name: string
    benchmarkTicker: string
    benchmarkName: string
    benchmarkIndex: RpsBenchmarkIndexInfo
    series: RpsTurnoverHistoryPoint[]
  }
}> {
  const profile = getTickerProfileOrThrow(args.ticker)
  const endDate = new Date().toISOString().slice(0, 10)
  const cacheKey = `rps:turnover:${profile.ticker}:${endDate}`
  return await readCacheRemember(cacheKey, async () => {
    const fetched = await fetchRpsTurnoverSeries({ ticker: profile.ticker, endDate })
    const history = buildRpsTurnoverHistory(fetched.series)
    const dataDate = history[history.length - 1]?.date ?? fetched.series[fetched.series.length - 1]?.date ?? null
    return {
      meta: {
        fetchedAt: new Date().toISOString(),
        dataDate,
        source: fetched.source,
        notes: [
          `ticker=${profile.ticker}`,
          `rps_benchmark=${RPS_BENCHMARK_TICKER} ${RPS_BENCHMARK_NAME}`,
          `target_index=${profile.benchmarkIndex.code} ${profile.benchmarkIndex.name}`,
          'turnover=ETF日线成交额，单位按数据源原始口径返回（东方财富日线通常为元）。',
          `turnoverMultipleOfPrev20Avg=当日成交额/过去${RPS_TURNOVER_LOOKBACK_DAYS}个真实交易日成交额均值，结果保留2位小数。`,
          `history_window=${RPS_TURNOVER_DISPLAY_DAYS} trading_days`,
        ],
        isFallback: false,
      },
      data: {
        ticker: profile.ticker,
        code: profile.code,
        name: profile.name,
        benchmarkTicker: RPS_BENCHMARK_TICKER,
        benchmarkName: RPS_BENCHMARK_NAME,
        benchmarkIndex: profile.benchmarkIndex,
        series: history,
      },
    }
  })
}

export async function getRpsStyleMatrix(args?: {
  startDate?: string
  endDate?: string
}): Promise<{
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    isFallback: boolean
  }
  data: {
    benchmarkTicker: string
    benchmarkName: string
    mode: 'risk_on' | 'risk_off'
    leaderTicker: string | null
    suggestedAttackPositionPct: number
    items: Array<{
      ticker: string
      date: string
      targetCloseQfq: number
      benchmarkCloseQfq: number
      rpsRaw: number
      rpsMa50: number | null
      scorePct: number | null
      trend: 'up' | 'down' | 'flat'
    }>
  }
}> {
  const startDate = normalizeYmd10(args?.startDate) || '2016-01-01'
  const endDate = normalizeYmd10(args?.endDate) || new Date().toISOString().slice(0, 10)
  const cacheKey = `rps:matrix:${startDate}:${endDate}`
  return await readCacheRemember(cacheKey, async () => {
    const rows: Array<{
      ticker: string
      point: RpsComputedPoint
      usedRunId: string | null
      fallbackReason: string | null
      fetchedAt: string
    }> = []

    let globalDate: string | null = null
    let globalFetchedAt = new Date(0).toISOString()
    const runNotes: string[] = []
    const currentMeta = await readRpsStyleMeta()
    let isFallback = false

    for (const ticker of RPS_TARGET_TICKERS) {
      const out = await getSeriesFromSupabaseRuns({ ticker, startDate, endDate })
      const last = out.series.length ? out.series[out.series.length - 1] : null
      if (!last) continue
      rows.push({ ticker, point: last, usedRunId: out.usedRunId, fallbackReason: out.fallbackReason, fetchedAt: out.fetchedAt })
      if (!globalDate || last.date > globalDate) globalDate = last.date
      if (out.fetchedAt > globalFetchedAt) globalFetchedAt = out.fetchedAt
      if (out.usedRunId && currentMeta?.currentRunId && out.usedRunId !== currentMeta.currentRunId) isFallback = true
      if (out.usedRunId) runNotes.push(`${ticker}:run_id=${out.usedRunId}`)
      if (out.fallbackReason) runNotes.push(`${ticker}:fallback=${out.fallbackReason}`)
    }
    if (!rows.length) throw new Error('暂无可用 RPS 矩阵数据')

    const sorted = [...rows].sort((a, b) => {
      const sa = typeof a.point.scorePct === 'number' ? a.point.scorePct : -Infinity
      const sb = typeof b.point.scorePct === 'number' ? b.point.scorePct : -Infinity
      return sb - sa
    })
    const positive = sorted.filter((x) => typeof x.point.scorePct === 'number' && (x.point.scorePct as number) > 0)
    const leader = positive.length ? positive[0] : null
    const mode: 'risk_on' | 'risk_off' = positive.length > 0 ? 'risk_on' : 'risk_off'

    return {
      meta: {
        fetchedAt: globalFetchedAt,
        dataDate: globalDate,
        source: 'supabase:rps_style_point',
        notes: [...getRpsStyleComputationNotes(), ...runNotes],
        isFallback,
      },
      data: {
        benchmarkTicker: RPS_BENCHMARK_TICKER,
        benchmarkName: RPS_BENCHMARK_NAME,
        mode,
        leaderTicker: leader?.ticker ?? null,
        suggestedAttackPositionPct: mode === 'risk_on' ? 33 : 0,
        items: sorted.map((x) => ({
          ticker: x.ticker,
          date: x.point.date,
          targetCloseQfq: x.point.targetCloseQfq,
          benchmarkCloseQfq: x.point.benchmarkCloseQfq,
          rpsRaw: x.point.rpsRaw,
          rpsMa50: x.point.rpsMa50,
          scorePct: x.point.scorePct,
          trend:
            typeof x.point.scorePct === 'number' && x.point.scorePct > 0
              ? 'up'
              : typeof x.point.scorePct === 'number' && x.point.scorePct < 0
                ? 'down'
                : 'flat',
        })),
      },
    }
  })
}

export async function getRpsStyleTurnoverSummary(): Promise<{
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    isFallback: boolean
  }
  data: {
    items: RpsTurnoverSummaryItem[]
  }
}> {
  const endDate = new Date().toISOString().slice(0, 10)
  const cacheKey = `rps:turnover-summary:${endDate}`
  return await readCacheRemember(cacheKey, async () => {
    const tickers = getRpsStyleTurnoverSupportedTickers()
    const histories = await Promise.all(tickers.map((ticker) => getRpsStyleTurnoverHistory({ ticker })))
    const items = histories.map((out) => {
      const profile = getTickerProfileOrThrow(out.data.ticker)
      return buildRpsTurnoverSummaryItem(profile, out.data.series)
    })
    const fetchedAt = histories.reduce((latest, out) => (out.meta.fetchedAt > latest ? out.meta.fetchedAt : latest), new Date(0).toISOString())
    const dataDate = histories.reduce<string | null>((latest, out) => {
      const current = out.meta.dataDate
      if (!current) return latest
      if (!latest || current > latest) return current
      return latest
    }, null)
    return {
      meta: {
        fetchedAt,
        dataDate,
        source: 'rps:turnover-summary',
        notes: [
          'summary_window=最近90个交易日成交额历史',
          `summary_threshold=成交额较前${RPS_TURNOVER_LOOKBACK_DAYS}日均值>=1.50x`,
          'tradingDaysAgo=以各ETF当前最新交易日为基准按交易日数量计算',
        ],
        isFallback: false,
      },
      data: { items },
    }
  })
}

export async function getRpsCustomQuery(args: {
  ticker: string
  startDate?: string
  endDate?: string
}): Promise<RpsCustomQueryResult> {
  const profile = await resolveRpsCustomTickerProfile(args.ticker)
  const inputTicker = String(args.ticker || '').trim().toUpperCase()
  const startDate = normalizeYmd10(args.startDate) || '2016-01-01'
  const endDate = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const cacheKey = buildRpsCustomQueryCacheKey(profile.ticker, startDate, endDate)
  return await readCacheRemember(cacheKey, async () => {
    const [seriesOut, turnoverOut] = await Promise.all([
      computeRpsSeriesForTicker({ ticker: profile.ticker, startDate, endDate }),
      fetchRpsTurnoverSeries({ ticker: profile.ticker, endDate }),
    ])
    const turnoverSeriesRaw = buildRpsTurnoverHistory(turnoverOut.series, {
      displayDays: RPS_CUSTOM_QUERY_TURNOVER_DISPLAY_DAYS,
    })
    const effectiveDataDate = resolveSharedLatestCompleteTradingDate({
      rpsSeries: seriesOut.series,
      turnoverSeries: turnoverSeriesRaw,
    })
    const series = clipSeriesToInclusiveEndDate(seriesOut.series, effectiveDataDate)
    const turnoverSeries = clipSeriesToInclusiveEndDate(turnoverSeriesRaw, effectiveDataDate)
    const latestTurnoverSummary = buildRpsLatestTurnoverSummary(turnoverSeries)
    const latest = series.length
      ? {
          date: series[series.length - 1].date,
          targetCloseQfq: series[series.length - 1].targetCloseQfq,
          benchmarkCloseQfq: series[series.length - 1].benchmarkCloseQfq,
          rpsRaw: series[series.length - 1].rpsRaw,
          rpsMa50: series[series.length - 1].rpsMa50,
          scorePct: series[series.length - 1].scorePct,
        }
      : null
    const dataDate = effectiveDataDate ?? latest?.date ?? turnoverSeries[turnoverSeries.length - 1]?.date ?? null
    const summary = {
      inputTicker,
      ticker: profile.ticker,
      code: profile.code,
      name: profile.name,
      benchmarkTicker: seriesOut.benchmarkTicker,
      benchmarkName: seriesOut.benchmarkName,
      latest,
      latestTurnoverSummary,
    }
    return {
      meta: {
        fetchedAt: new Date().toISOString(),
        dataDate,
        source: 'rps:custom-query',
        notes: [
          ...getRpsStyleComputationNotes(),
          `input_ticker=${inputTicker}`,
          `normalized_ticker=${profile.ticker}`,
          `name_source=${profile.nameSource}`,
          `target_source=${seriesOut.targetSource}`,
          `benchmark_source=${seriesOut.benchmarkSource}`,
          `turnover_source=${turnoverOut.source}`,
          `custom_turnover_window=${RPS_CUSTOM_QUERY_TURNOVER_DISPLAY_DAYS} trading_days`,
          'custom_query_latest_metrics=latest_complete_trading_day_only',
          ...(effectiveDataDate ? [`effective_data_date=${effectiveDataDate}`] : []),
        ],
        isFallback: false,
      },
      data: {
        summary,
        inputTicker,
        ticker: profile.ticker,
        code: profile.code,
        name: profile.name,
        benchmarkTicker: seriesOut.benchmarkTicker,
        benchmarkName: seriesOut.benchmarkName,
        latest,
        latestTurnoverSummary,
        series,
        turnoverSeries,
      },
    }
  })
}

export async function getRpsSignalSeries(args: {
  ticker: string
  startDate?: string
  endDate?: string
}): Promise<RpsSignalSeriesResult> {
  const profile = await resolveRpsCustomTickerProfile(args.ticker)
  const inputTicker = String(args.ticker || '').trim().toUpperCase()
  const startDate = normalizeYmd10(args.startDate) || '2016-01-01'
  const endDate = normalizeYmd10(args.endDate) || new Date().toISOString().slice(0, 10)
  const cacheKey = `rps:signal-series:${profile.ticker}:${startDate}:${endDate}`
  return await readCacheRemember(cacheKey, async () => {
    const seriesOut = await computeRpsSeriesForTicker({ ticker: profile.ticker, startDate, endDate })
    const series = seriesOut.series
    const latest = series.length
      ? {
          date: series[series.length - 1].date,
          targetCloseQfq: series[series.length - 1].targetCloseQfq,
          benchmarkCloseQfq: series[series.length - 1].benchmarkCloseQfq,
          rpsRaw: series[series.length - 1].rpsRaw,
          rpsMa50: series[series.length - 1].rpsMa50,
          scorePct: series[series.length - 1].scorePct,
        }
      : null
    const dataDate = latest?.date ?? null
    return {
      meta: {
        fetchedAt: new Date().toISOString(),
        dataDate,
        source: 'rps:signal-series',
        notes: [
          ...getRpsStyleComputationNotes(),
          `input_ticker=${inputTicker}`,
          `normalized_ticker=${profile.ticker}`,
          `name_source=${profile.nameSource}`,
          `target_source=${seriesOut.targetSource}`,
          `benchmark_source=${seriesOut.benchmarkSource}`,
          'signal_series_mode=price_and_score_only',
        ],
        isFallback: false,
      },
      data: {
        inputTicker,
        ticker: profile.ticker,
        code: profile.code,
        name: profile.name,
        benchmarkTicker: seriesOut.benchmarkTicker,
        benchmarkName: seriesOut.benchmarkName,
        latest,
        series,
      },
    }
  })
}

export async function getRpsStyleSummary(): Promise<{
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
  }
  data: {
    benchmarkTicker: string
    benchmarkName: string
    mode: 'risk_on' | 'risk_off'
    leaderTicker: string | null
    suggestedAttackPositionPct: number
    isFallback: boolean
    leaderScorePct: number | null
  }
}> {
  return await readCacheRemember('rps:summary:v1', async () => {
    const m = await getRpsStyleMatrix()
    const leader = m.data.items.length ? m.data.items[0] : null
    return {
      meta: {
        fetchedAt: m.meta.fetchedAt,
        dataDate: m.meta.dataDate,
        source: m.meta.source,
        notes: m.meta.notes,
      },
      data: {
        benchmarkTicker: m.data.benchmarkTicker,
        benchmarkName: m.data.benchmarkName,
        mode: m.data.mode,
        leaderTicker: m.data.leaderTicker,
        suggestedAttackPositionPct: m.data.suggestedAttackPositionPct,
        isFallback: m.meta.isFallback,
        leaderScorePct: leader?.scorePct ?? null,
      },
    }
  })
}

export async function getRpsStylePanel(args?: {
  startDate?: string
  endDate?: string
}): Promise<{
  meta: {
    fetchedAt: string
    dataDate: string | null
    source: string
    notes: string[]
    isFallback: boolean
  }
  data: {
    summary: {
      benchmarkTicker: string
      benchmarkName: string
      mode: 'risk_on' | 'risk_off'
      leaderTicker: string | null
      suggestedAttackPositionPct: number
      isFallback: boolean
      leaderScorePct: number | null
    }
    matrix: {
      benchmarkTicker: string
      benchmarkName: string
      mode: 'risk_on' | 'risk_off'
      leaderTicker: string | null
      suggestedAttackPositionPct: number
      items: Array<{
        ticker: string
        date: string
        targetCloseQfq: number
        benchmarkCloseQfq: number
        rpsRaw: number
        rpsMa50: number | null
        scorePct: number | null
        trend: 'up' | 'down' | 'flat'
      }>
    }
    seriesByTicker: Record<string, RpsComputedPoint[]>
  }
}> {
  const startDate = normalizeYmd10(args?.startDate) || '2016-01-01'
  const endDate = normalizeYmd10(args?.endDate) || new Date().toISOString().slice(0, 10)
  const cacheKey = `rps:panel:${startDate}:${endDate}`
  return await readCacheRemember(cacheKey, async () => {
    const matrix = await getRpsStyleMatrix({ startDate, endDate })
    const leader = matrix.data.items.length ? matrix.data.items[0] : null
    const summary = {
      benchmarkTicker: matrix.data.benchmarkTicker,
      benchmarkName: matrix.data.benchmarkName,
      mode: matrix.data.mode,
      leaderTicker: matrix.data.leaderTicker,
      suggestedAttackPositionPct: matrix.data.suggestedAttackPositionPct,
      isFallback: matrix.meta.isFallback,
      leaderScorePct: leader?.scorePct ?? null,
    }
    const tickers = matrix.data.items.map((x) => x.ticker)
    const allSeries = await Promise.all(
      tickers.map(async (ticker) => {
        const out = await getRpsStyleSeries({ ticker, startDate, endDate })
        return [ticker, out.data.series] as const
      }),
    )
    return {
      meta: matrix.meta,
      data: {
        summary,
        matrix: matrix.data,
        seriesByTicker: Object.fromEntries(allSeries),
      },
    }
  })
}
