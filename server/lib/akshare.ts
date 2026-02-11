import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

type AkshareOk<T> = {
  success: true
  meta: {
    fetchedAt: string
    dataDate: string
    source?: string
    notes?: string[]
  }
  data: T
}

type AkshareErr = {
  success: false
  error: string
  message: string
}

type AkshareResp<T> = AkshareOk<T> | AkshareErr

const cache = new Map<string, { expiresAt: number; value: AkshareResp<unknown> }>()
const inflight = new Map<string, Promise<AkshareResp<unknown>>>()

function getScriptPath() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../python/akshare_service.py')
}

function execPython(args: string[], timeoutMs: number): Promise<string> {
  const bin = process.env.AKSHARE_PYTHON_BIN || process.env.PYTHON_BIN || 'python'
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
          const e = err as NodeJS.ErrnoException
          const outText = String(stdout || '').trim()
          const errText = String(stderr || '').trim()
          const code = (e.code ?? '') as unknown

          const looksLikeMissingPython =
            code === 'ENOENT' ||
            code === 9009 ||
            code === '9009' ||
            (!outText && !errText && String(err).includes('Command failed: python'))

          if (looksLikeMissingPython) {
            const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL)
            reject(
              new Error(
                isVercel
                  ? '当前运行环境不提供可执行的 Python（Vercel Serverless 不支持通过子进程调用本机 Python）。请将后端部署到支持 Python 的服务器，或改为不依赖 Python 的实现。'
                  : '未检测到可用的 Python：请安装 Python 3，并确保命令行可运行 `python`（Windows 可能需要关闭“应用执行别名”）。',
              ),
            )
            return
          }

          reject(new Error(errText || outText || String(err)))
          return
        }
        resolve(String(stdout))
      },
    )
  })
}

function parseJson<T>(text: string): AkshareResp<T> {
  const t = text.trim()
  if (!t) {
    return { success: false, error: 'akshare_error', message: 'AkShare 服务未返回内容' }
  }
  try {
    return JSON.parse(t) as AkshareResp<T>
  } catch {
    return {
      success: false,
      error: 'akshare_error',
      message: 'AkShare 返回非 JSON 内容',
    }
  }
}

export async function runAkshare<T>(
  cacheKey: string,
  args: string[],
  opts?: { cacheTtlMs?: number; timeoutMs?: number },
): Promise<AkshareResp<T>> {
  const ttl = opts?.cacheTtlMs ?? 120_000
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > now) return hit.value as AkshareResp<T>

  const existing = inflight.get(cacheKey)
  if (existing) return (await existing) as AkshareResp<T>

  const p = (async (): Promise<AkshareResp<T>> => {
    try {
      const out = await execPython(args, opts?.timeoutMs ?? 60_000)
      const json = parseJson<T>(out)
      cache.set(cacheKey, { expiresAt: now + ttl, value: json as AkshareResp<unknown> })
      return json
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const json: AkshareResp<T> = { success: false, error: 'akshare_error', message: msg }
      cache.set(cacheKey, { expiresAt: now + 5_000, value: json as AkshareResp<unknown> })
      return json
    } finally {
      inflight.delete(cacheKey)
    }
  })()

  inflight.set(cacheKey, p as unknown as Promise<AkshareResp<unknown>>)
  return (await p) as AkshareResp<T>
}
