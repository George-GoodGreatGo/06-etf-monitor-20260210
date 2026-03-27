import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

type BaoOk<T> = {
  success: true
  meta: {
    fetchedAt: string
    dataDate: string | null
    source?: string
    notes?: string[]
  }
  data: T
}

type BaoErr = {
  success: false
  error: string
  message: string
}

export type BaoResp<T> = BaoOk<T> | BaoErr

const cache = new Map<string, { expiresAt: number; value: BaoResp<unknown> }>()
const inflight = new Map<string, Promise<BaoResp<unknown>>>()

function getScriptPath() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../python/baostock_service.py')
}

function execPython(args: string[], timeoutMs: number): Promise<string> {
  const bin = process.env.BAOSTOCK_PYTHON_BIN || process.env.PYTHON_BIN || 'python'
  const script = getScriptPath()
  const clearProxy = process.env.AKSHARE_CLEAR_PROXY === '1'

  return new Promise((resolve, reject) => {
    execFile(
      bin,
      [script, ...args],
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          ...(clearProxy
            ? {
                HTTP_PROXY: '',
                HTTPS_PROXY: '',
                ALL_PROXY: '',
                NO_PROXY: '*',
              }
            : {}),
        },
      },
      (err, stdout, stderr) => {
        if (err) {
          const outText = String(stdout || '').trim()
          const errText = String(stderr || '').trim()
          reject(new Error(errText || outText || String(err)))
          return
        }
        resolve(String(stdout))
      },
    )
  })
}

function parseJson<T>(text: string): BaoResp<T> {
  const t = text.trim()
  if (!t) return { success: false, error: 'baostock_error', message: 'Baostock 服务未返回内容' }
  try {
    return JSON.parse(t) as BaoResp<T>
  } catch {
    return { success: false, error: 'baostock_error', message: 'Baostock 返回非 JSON 内容' }
  }
}

export async function runBaostock<T>(
  cacheKey: string,
  args: string[],
  opts?: { cacheTtlMs?: number; timeoutMs?: number },
): Promise<BaoResp<T>> {
  const ttl = opts?.cacheTtlMs ?? 120_000
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > now) return hit.value as BaoResp<T>

  const existing = inflight.get(cacheKey)
  if (existing) return (await existing) as BaoResp<T>

  const p = (async (): Promise<BaoResp<T>> => {
    try {
      const out = await execPython(args, opts?.timeoutMs ?? 60_000)
      const json = parseJson<T>(out)
      cache.set(cacheKey, { expiresAt: now + ttl, value: json as BaoResp<unknown> })
      return json
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const json: BaoResp<T> = { success: false, error: 'baostock_error', message: msg }
      cache.set(cacheKey, { expiresAt: now + 5_000, value: json as BaoResp<unknown> })
      return json
    } finally {
      inflight.delete(cacheKey)
    }
  })()

  inflight.set(cacheKey, p as unknown as Promise<BaoResp<unknown>>)
  return (await p) as BaoResp<T>
}

