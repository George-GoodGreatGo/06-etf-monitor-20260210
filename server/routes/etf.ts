import express, { type Request, type Response } from 'express'
import { runAkshare } from '../lib/akshare.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTop100LatestSnapshot } from '../lib/supabaseRest.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pythonCacheDir = path.join(__dirname, '..', 'python', '.cache')

function sanitizeProgressToken(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  if (t.length > 64) return null
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null
  return t
}

function progressFilePath(token: string): string {
  const p = path.join(pythonCacheDir, `progress_${token}.json`)
  const resolved = path.resolve(p)
  const base = path.resolve(pythonCacheDir)
  if (!resolved.startsWith(base)) {
    return path.join(pythonCacheDir, 'progress_invalid.json')
  }
  return resolved
}

router.get('/progress', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')

  if (process.env.VERCEL) {
    res.status(200).json({ success: true, data: null })
    return
  }

  const token = sanitizeProgressToken(req.query._p)
  if (!token) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 _p' })
    return
  }

  try {
    const text = await fs.readFile(progressFilePath(token), 'utf-8')
    const j = JSON.parse(text) as unknown
    res.status(200).json({ success: true, data: j })
  } catch {
    res.status(200).json({ success: true, data: null })
  }
})

router.get('/top100', (req: Request, res: Response) => {
  const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : ''
  const limit = Math.max(1, Math.min(200, Number.parseInt(limitRaw || '100', 10) || 100))

  const refresh =
    req.query.refresh === '1' ||
    (typeof req.query._t === 'string' && req.query._t.trim().length > 0)
  const refreshToken = typeof req.query._t === 'string' ? req.query._t : ''

  const ensureLatest = req.query.ensureLatest === '1'
  const progressToken = sanitizeProgressToken(req.query._p)
  const progressFile = progressToken ? progressFilePath(progressToken) : ''

  if (process.env.VERCEL) {
    void (async () => {
      const snap = await readTop100LatestSnapshot()
      if (!snap || !Array.isArray(snap.rows)) {
        res.status(503).json({
          success: false,
          error: 'cache_miss',
          message: 'Supabase 未找到 Top100 快照数据，请先写入 `top100_latest(id=1)`',
        })
        return
      }

      const notes: string[] = Array.isArray(snap.notes) ? (snap.notes as unknown[]).filter((x) => typeof x === 'string') as string[] : []
      if (refresh || ensureLatest) {
        notes.unshift('当前部署环境不支持实时重算；refresh/ensureLatest 会退化为读取 Supabase 最新快照。')
      }

      res.status(200).json({
        success: true,
        meta: {
          fetchedAt: snap.fetched_at,
          dataDate: snap.data_date,
          cachedAt: snap.cached_at || undefined,
          source: snap.source || 'supabase:snapshot',
          notes,
          backgroundRefresh: refresh || ensureLatest ? true : undefined,
        },
        data: (snap.rows as unknown[]).slice(0, limit),
      })
    })()
    return
  }

  if (!refresh && !ensureLatest) {
    const cacheFile = path.join(pythonCacheDir, 'top100_latest.json')
    fs.readFile(cacheFile, 'utf-8')
      .then((text) => {
        const j = JSON.parse(text) as unknown
        if (!j || typeof j !== 'object') throw new Error('bad_cache')
        const o = j as Record<string, unknown>
        const cachedAt = typeof o.cachedAt === 'string' ? o.cachedAt : ''
        const dataDate = typeof o.dataDate === 'string' ? o.dataDate : ''
        const rows = Array.isArray(o.rows) ? (o.rows as unknown[]) : null
        if (!cachedAt || !dataDate || !rows || rows.length === 0) throw new Error('bad_cache')

        res.status(200).json({
          success: true,
          meta: {
            fetchedAt: cachedAt,
            dataDate,
            cachedAt,
            source: 'akshare:sina',
            notes: [
              'Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。',
              '成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。',
            ],
          },
          data: rows.slice(0, limit),
        })
      })
      .catch(() => {
        res.status(503).json({
          success: false,
          error: 'cache_miss',
          message: '未命中本地缓存，请点击“重新获取”',
        })
      })
    return
  }

  runAkshare(
    refresh
      ? `top100:v11:${limit}:refresh:${refreshToken || Date.now()}`
      : ensureLatest
        ? `top100:v11:${limit}:ensureLatest:${Date.now()}`
        : `top100:v11:${limit}`,
    refresh
      ? ['top100', '--limit', String(limit), '--refresh', ...(progressFile ? ['--progress-file', progressFile] : [])]
      : ensureLatest
        ? [
            'top100',
            '--limit',
            String(limit),
            '--ensure-latest',
            ...(progressFile ? ['--progress-file', progressFile] : []),
          ]
        : ['top100', '--limit', String(limit), ...(progressFile ? ['--progress-file', progressFile] : [])],
    { cacheTtlMs: refresh || ensureLatest ? 0 : 600_000, timeoutMs: 900_000 },
  )
    .then((out) => {
      if (out.success === true) {
        res.status(200).json(out)
        if (progressFile) void fs.unlink(progressFile).catch(() => null)
        return
      }

      if (out.error === 'cache_miss') {
        res.status(503).json(out)
        if (progressFile) void fs.unlink(progressFile).catch(() => null)
        return
      }

      const msg = out.message || ''
      const status = msg.includes('未检测到') ? 501 : 502
      res.status(status).json(out)
      if (progressFile) void fs.unlink(progressFile).catch(() => null)
    })
    .catch((e) => {
      res.status(502).json({
        success: false,
        error: 'akshare_error',
        message: e instanceof Error ? e.message : String(e),
      })
      if (progressFile) void fs.unlink(progressFile).catch(() => null)
    })
})

router.get('/detail/:code', (req: Request, res: Response) => {
  const code = String(req.params.code || '').trim()
  if (!code) {
    res.status(400).json({ success: false, error: 'bad_request', message: '缺少 code' })
    return
  }

  if (process.env.VERCEL) {
    void (async () => {
      const snap = await readTop100LatestSnapshot()
      if (!snap || !Array.isArray(snap.rows)) {
        res.status(503).json({
          success: false,
          error: 'cache_miss',
          message: 'Supabase 未找到 Top100 快照数据，请先写入 `top100_latest(id=1)`',
        })
        return
      }

      const row = (snap.rows as unknown[]).find((r) =>
        typeof r === 'object' && r !== null && 'code' in r && String((r as Record<string, unknown>).code) === code,
      ) as Record<string, unknown> | undefined

      if (!row) {
        res.status(404).json({ success: false, error: 'not_found', message: '未找到该 ETF' })
        return
      }

      res.status(200).json({
        success: true,
        meta: {
          fetchedAt: snap.fetched_at,
          dataDate: snap.data_date,
          cachedAt: snap.cached_at || undefined,
          source: snap.source || 'supabase:snapshot',
        },
        data: {
          code,
          name: typeof row.name === 'string' ? row.name : null,
          latestTradingDate: typeof row.latestTradingDate === 'string' ? row.latestTradingDate : null,
          z90: typeof row.z90 === 'number' ? row.z90 : null,
        },
      })
    })()
    return
  }

  runAkshare(`detail:${code}`, ['detail', '--code', code], {
    cacheTtlMs: 120_000,
    timeoutMs: 60_000,
  })
    .then((out) => {
      if (out.success === true) {
        res.status(200).json(out)
        return
      }
      const msg = out.message || ''
      const status = msg.includes('未检测到') ? 501 : 502
      res.status(status).json(out)
    })
    .catch((e) => {
      res.status(502).json({
        success: false,
        error: 'akshare_error',
        message: e instanceof Error ? e.message : String(e),
      })
    })
})

export default router
