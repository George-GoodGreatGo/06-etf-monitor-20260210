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

type ExecPythonResult = {
  stdout: string
  stderr: string
}

function execPython(args: string[], timeoutMs: number): Promise<ExecPythonResult> {
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
        resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
      },
    )
  })
}

function summarizeSnippet(text: string, maxLen = 240): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '(empty)'
  return normalized.length <= maxLen ? normalized : `${normalized.slice(0, maxLen)}...`
}

function tryParseBaoResp<T>(text: string): BaoResp<T> | null {
  try {
    return JSON.parse(text) as BaoResp<T>
  } catch {
    return null
  }
}

function extractJsonPayload(text: string): string | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return null
}

function parseJson<T>(result: ExecPythonResult, args: string[]): BaoResp<T> {
  const stdout = String(result.stdout || '')
  const stderr = String(result.stderr || '')
  const direct = tryParseBaoResp<T>(stdout.trim())
  if (direct) return direct

  const extracted = extractJsonPayload(stdout)
  if (extracted) {
    const parsed = tryParseBaoResp<T>(extracted)
    if (parsed) return parsed
  }

  const cmd = ['python', path.basename(getScriptPath()), ...args].join(' ')
  const stdoutHead = summarizeSnippet(stdout, 220)
  const stdoutTail = summarizeSnippet(stdout.slice(-220), 220)
  const stderrHead = summarizeSnippet(stderr, 180)
  return {
    success: false,
    error: 'baostock_error',
    message: `Baostock 返回非 JSON 内容; cmd=${cmd}; stdout_head=${stdoutHead}; stdout_tail=${stdoutTail}; stderr=${stderrHead}`,
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
      const json = parseJson<T>(out, args)
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
