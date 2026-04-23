import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const RPS_CUSTOM_QUERY_RECENT_SEARCHES_LIMIT = 10

export type RpsCustomRecentSearchItem = {
  ticker: string
  code: string
  name: string
  updatedAt: string
}

type RecentSearchStorage = {
  users: Record<string, RpsCustomRecentSearchItem[]>
}

const EMPTY_STORAGE: RecentSearchStorage = { users: {} }

let storageWriteQueue = Promise.resolve()

function getStorageFileOverridePath(): string {
  const override = String(process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE || '').trim()
  return override
}

function getSupabaseConfig(): { supabaseUrl: string; serviceKey: string } | null {
  const supabaseUrl = String(process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceKey) return null
  return { supabaseUrl, serviceKey }
}

function getSupabaseHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }
}

function normalizeUserKey(userKeyRaw: string): string {
  return String(userKeyRaw || '').trim().toLowerCase()
}

function normalizeTicker(raw: string): string {
  return String(raw || '').trim().toUpperCase()
}

function normalizeCode(raw: string, ticker: string): string {
  const code = String(raw || '').trim()
  if (code) return code
  return ticker.includes('.') ? ticker.split('.')[0] || ticker : ticker
}

function normalizeName(raw: string, code: string): string {
  const name = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
  return name || code
}

function normalizeUpdatedAt(raw: string): string {
  const value = String(raw || '').trim()
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return new Date().toISOString()
  return new Date(ms).toISOString()
}

function normalizeItem(raw: Partial<RpsCustomRecentSearchItem> | null | undefined): RpsCustomRecentSearchItem | null {
  const ticker = normalizeTicker(raw?.ticker || '')
  if (!ticker) return null
  const code = normalizeCode(raw?.code || '', ticker)
  return {
    ticker,
    code,
    name: normalizeName(raw?.name || '', code),
    updatedAt: normalizeUpdatedAt(raw?.updatedAt || ''),
  }
}

function sortAndLimit(items: RpsCustomRecentSearchItem[]): RpsCustomRecentSearchItem[] {
  return [...items]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, RPS_CUSTOM_QUERY_RECENT_SEARCHES_LIMIT)
}

function normalizeStoredItems(itemsRaw: unknown): RpsCustomRecentSearchItem[] {
  if (!Array.isArray(itemsRaw)) return []
  const deduped = new Map<string, RpsCustomRecentSearchItem>()
  for (const itemRaw of itemsRaw) {
    const item = normalizeItem(itemRaw as Partial<RpsCustomRecentSearchItem>)
    if (!item) continue
    const existing = deduped.get(item.ticker)
    if (!existing || Date.parse(item.updatedAt) >= Date.parse(existing.updatedAt)) {
      deduped.set(item.ticker, item)
    }
  }
  return sortAndLimit([...deduped.values()])
}

function mergeRecentSearches(
  currentItems: RpsCustomRecentSearchItem[],
  nextItemRaw: Pick<RpsCustomRecentSearchItem, 'ticker' | 'code' | 'name'>,
  now = new Date(),
): RpsCustomRecentSearchItem[] {
  const nextItem = normalizeItem({ ...nextItemRaw, updatedAt: now.toISOString() })
  if (!nextItem) return normalizeStoredItems(currentItems)
  const merged = [nextItem, ...normalizeStoredItems(currentItems).filter((item) => item.ticker !== nextItem.ticker)]
  return sortAndLimit(merged)
}

async function ensureStorageDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
}

async function readStorage(): Promise<RecentSearchStorage> {
  const filePath = getStorageFileOverridePath()
  if (!filePath) return { ...EMPTY_STORAGE }
  try {
    const text = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(text) as unknown
    const usersRaw =
      parsed && typeof parsed === 'object' && 'users' in (parsed as Record<string, unknown>)
        ? (parsed as { users?: Record<string, unknown> }).users
        : null
    if (!usersRaw || typeof usersRaw !== 'object') return { ...EMPTY_STORAGE }
    const users = Object.fromEntries(
      Object.entries(usersRaw).flatMap(([userKey, itemsRaw]) => {
        const normalizedUserKey = normalizeUserKey(userKey)
        if (!normalizedUserKey) return []
        return [[normalizedUserKey, normalizeStoredItems(itemsRaw)]]
      }),
    )
    return { users }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code || '') : ''
    if (code === 'ENOENT') return { ...EMPTY_STORAGE }
    throw error
  }
}

async function writeStorage(storage: RecentSearchStorage): Promise<void> {
  const filePath = getStorageFileOverridePath()
  if (!filePath) return
  await ensureStorageDir(filePath)
  await writeFile(filePath, `${JSON.stringify(storage, null, 2)}\n`, 'utf-8')
}

async function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  const run = storageWriteQueue.then(task, task)
  storageWriteQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return await run
}

async function listRpsCustomRecentSearchesFromSupabase(userKey: string): Promise<RpsCustomRecentSearchItem[]> {
  const config = getSupabaseConfig()
  if (!config) return []
  const url =
    `${config.supabaseUrl}/rest/v1/rps_custom_recent_search?` +
    `user_key=eq.${encodeURIComponent(userKey)}` +
    `&select=ticker,code,name,updated_at` +
    `&order=updated_at.desc,ticker.asc` +
    `&limit=${RPS_CUSTOM_QUERY_RECENT_SEARCHES_LIMIT}`
  const res = await fetch(url, {
    headers: getSupabaseHeaders(config.serviceKey),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase read rps_custom_recent_search failed: HTTP ${res.status} ${body}`)
  }
  const rows = (await res.json().catch(() => null)) as unknown
  if (!Array.isArray(rows)) return []
  return normalizeStoredItems(
    rows.map((row) => {
      const record = row as Record<string, unknown>
      return {
        ticker: record.ticker,
        code: record.code,
        name: record.name,
        updatedAt: record.updated_at,
      }
    }),
  )
}

async function recordRpsCustomRecentSearchToSupabase(
  userKey: string,
  item: Pick<RpsCustomRecentSearchItem, 'ticker' | 'code' | 'name'>,
): Promise<RpsCustomRecentSearchItem[]> {
  const config = getSupabaseConfig()
  if (!config) return []
  const normalized = normalizeItem(item)
  if (!normalized) return []
  const rpcUrl = `${config.supabaseUrl}/rest/v1/rpc/upsert_rps_custom_recent_search`
  const rpcRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(config.serviceKey),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      p_user_key: userKey,
      p_ticker: normalized.ticker,
      p_code: normalized.code,
      p_name: normalized.name,
      p_limit: RPS_CUSTOM_QUERY_RECENT_SEARCHES_LIMIT,
    }),
  })
  if (!rpcRes.ok) {
    const body = await rpcRes.text().catch(() => '')
    throw new Error(`supabase rpc upsert_rps_custom_recent_search failed: HTTP ${rpcRes.status} ${body}`)
  }
  return await listRpsCustomRecentSearchesFromSupabase(userKey)
}

export async function listRpsCustomRecentSearches(userKeyRaw: string): Promise<RpsCustomRecentSearchItem[]> {
  const userKey = normalizeUserKey(userKeyRaw)
  if (!userKey) return []
  if (getStorageFileOverridePath()) {
    const storage = await readStorage()
    return normalizeStoredItems(storage.users[userKey])
  }
  return await listRpsCustomRecentSearchesFromSupabase(userKey)
}

export async function recordRpsCustomRecentSearch(
  userKeyRaw: string,
  item: Pick<RpsCustomRecentSearchItem, 'ticker' | 'code' | 'name'>,
): Promise<RpsCustomRecentSearchItem[]> {
  const userKey = normalizeUserKey(userKeyRaw)
  if (!userKey) return []
  if (!getStorageFileOverridePath()) {
    return await recordRpsCustomRecentSearchToSupabase(userKey, item)
  }
  return await withStorageLock(async () => {
    const storage = await readStorage()
    const nextItems = mergeRecentSearches(storage.users[userKey] || [], item)
    storage.users[userKey] = nextItems
    await writeStorage(storage)
    return nextItems
  })
}

export function __mergeRpsCustomRecentSearchesForTest(
  currentItems: RpsCustomRecentSearchItem[],
  nextItem: Pick<RpsCustomRecentSearchItem, 'ticker' | 'code' | 'name'>,
  now?: Date,
): RpsCustomRecentSearchItem[] {
  return mergeRecentSearches(currentItems, nextItem, now)
}

export function __normalizeStoredRpsCustomRecentSearchItemsForTest(itemsRaw: unknown): RpsCustomRecentSearchItem[] {
  return normalizeStoredItems(itemsRaw)
}
