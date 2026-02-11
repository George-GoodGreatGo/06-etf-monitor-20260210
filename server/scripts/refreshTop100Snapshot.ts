import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)

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

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

function guessPythonBin(): string {
  return String(
    process.env.AKSHARE_PYTHON_BIN ||
      process.env.PYTHON_BIN ||
      (process.platform === 'win32' ? 'python' : 'python3'),
  )
}

async function computeTop100(limit: number): Promise<AkshareOk<unknown[]>> {
  const bin = guessPythonBin()
  const script = path.resolve('server/python/akshare_service.py')
  const { stdout } = await execFileAsync(
    bin,
    [script, 'top100', '--limit', String(limit), '--refresh', '--ensure-latest'],
    {
      timeout: 20 * 60_000,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    },
  )

  const text = String(stdout || '').trim()
  const j = (text ? (JSON.parse(text) as unknown) : null) as AkshareResp<unknown>
  if (!j || typeof j !== 'object') throw new Error('AkShare 返回为空')
  if ((j as AkshareErr).success === false) {
    const e = j as AkshareErr
    throw new Error(e.message || e.error || 'AkShare 调用失败')
  }
  const ok = j as AkshareOk<unknown>
  if (!Array.isArray(ok.data)) throw new Error('AkShare 返回数据结构异常')
  return ok as AkshareOk<unknown[]>
}

async function upsertToSupabase(ok: AkshareOk<unknown[]>) {
  const supabaseUrl = mustEnv('SUPABASE_URL').replace(/\/+$/, '')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')

  const payload = {
    id: 1,
    fetched_at: ok.meta.fetchedAt,
    data_date: ok.meta.dataDate,
    cached_at: ok.meta.fetchedAt,
    source: ok.meta.source || 'akshare:sina',
    notes: ok.meta.notes || [],
    rows: ok.data,
    updated_at: new Date().toISOString(),
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/top100_latest`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`supabase write failed: HTTP ${res.status} ${body}`)
  }

  return (await res.json().catch(() => null)) as unknown
}

async function main() {
  const limit = Number.parseInt(String(process.env.TOP100_LIMIT || '200'), 10) || 200
  const ok = await computeTop100(Math.max(1, Math.min(200, limit)))
  const written = await upsertToSupabase(ok)
  process.stdout.write(JSON.stringify({ success: true, meta: ok.meta, written }, null, 2))
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  process.stderr.write(msg)
  process.exit(1)
})
