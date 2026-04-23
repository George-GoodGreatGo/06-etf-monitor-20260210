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

function getStorageFilePath(): string {
  const override = String(process.env.RPS_CUSTOM_QUERY_RECENT_SEARCHES_FILE || '').trim()
  if (override) return override
  return path.resolve(process.cwd(), 'server', '.cache', 'rps-custom-query-recent-searches.json')
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
  const filePath = getStorageFilePath()
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
  const filePath = getStorageFilePath()
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

export async function listRpsCustomRecentSearches(userKeyRaw: string): Promise<RpsCustomRecentSearchItem[]> {
  const userKey = normalizeUserKey(userKeyRaw)
  if (!userKey) return []
  const storage = await readStorage()
  return normalizeStoredItems(storage.users[userKey])
}

export async function recordRpsCustomRecentSearch(
  userKeyRaw: string,
  item: Pick<RpsCustomRecentSearchItem, 'ticker' | 'code' | 'name'>,
): Promise<RpsCustomRecentSearchItem[]> {
  const userKey = normalizeUserKey(userKeyRaw)
  if (!userKey) return []
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
