import { Router, type Request, type Response } from 'express'
import {
  countActiveAdmins,
  getManagedUserByUsername,
  listManagedUsers,
  provisionManagedUser,
  resetManagedUserPassword,
  sanitizeUsername,
  toSafeManagedUser,
  updateManagedUser,
  type AuthRole,
  type AuthStatus,
} from '../lib/authUsers.js'

const router = Router()

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await listManagedUsers()
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      success: true,
      data: {
        items: users.map((user) => ({
          ...toSafeManagedUser(user),
          mustChangePassword: user.mustChangePassword,
          forcePasswordChange: user.mustChangePassword,
        })),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

router.post('/users', async (req: Request, res: Response) => {
  const body = (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}) as Record<string, unknown>
  const username = typeof body.username === 'string' ? body.username : ''
  const role = body.role === 'admin' ? 'admin' : 'user'
  try {
    const normalizedUsername = sanitizeUsername(username)
    const existing = await getManagedUserByUsername(normalizedUsername).catch(() => null)
    if (existing) {
      res.status(409).json({ success: false, error: 'conflict', message: '账号已存在' })
      return
    }
    const result = await provisionManagedUser({ username: normalizedUsername, role })
    res.status(201).json({
      success: true,
      data: {
        user: {
          ...toSafeManagedUser(result.user),
          mustChangePassword: result.user.mustChangePassword,
          forcePasswordChange: result.user.mustChangePassword,
        },
        temporaryPassword: result.temporaryPassword,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

router.post('/users/:username/reset-password', async (req: Request, res: Response) => {
  try {
    const username = sanitizeUsername(typeof req.params.username === 'string' ? req.params.username : '')
    const existing = await getManagedUserByUsername(username).catch(() => null)
    if (!existing) {
      res.status(404).json({ success: false, error: 'not_found', message: '账号不存在' })
      return
    }
    const result = await resetManagedUserPassword(username)
    res.status(200).json({
      success: true,
      data: {
        user: {
          ...toSafeManagedUser(result.user),
          mustChangePassword: result.user.mustChangePassword,
          forcePasswordChange: result.user.mustChangePassword,
        },
        temporaryPassword: result.temporaryPassword,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

router.patch('/users/:username', async (req: Request, res: Response) => {
  const body = (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}) as Record<string, unknown>
  const nextStatus = body.status === 'disabled' ? 'disabled' : body.status === 'active' ? 'active' : null
  const nextRole = body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : null
  if (!nextStatus && !nextRole) {
    res.status(400).json({ success: false, error: 'bad_request', message: '至少提供 status 或 role 之一' })
    return
  }
  try {
    const username = sanitizeUsername(typeof req.params.username === 'string' ? req.params.username : '')
    const existing = await getManagedUserByUsername(username).catch(() => null)
    if (!existing) {
      res.status(404).json({ success: false, error: 'not_found', message: '账号不存在' })
      return
    }
    const targetRole = (nextRole ?? existing.role) as AuthRole
    const targetStatus = (nextStatus ?? existing.status) as AuthStatus
    if (existing.role === 'admin' && (targetRole !== 'admin' || targetStatus !== 'active')) {
      const activeAdmins = await countActiveAdmins()
      if (activeAdmins <= 1) {
        res.status(400).json({ success: false, error: 'bad_request', message: '系统至少需要保留 1 个启用中的管理员账号' })
        return
      }
    }
    const user = await updateManagedUser({
      username,
      role: nextRole ?? undefined,
      status: nextStatus ?? undefined,
    })
    res.status(200).json({
      success: true,
      data: {
        user: {
          ...toSafeManagedUser(user),
          mustChangePassword: user.mustChangePassword,
          forcePasswordChange: user.mustChangePassword,
        },
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

router.post('/market/refresh', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const token = mustEnv('GITHUB_ACTIONS_TOKEN')
    const owner = mustEnv('GITHUB_OWNER')
    const repo = mustEnv('GITHUB_REPO')
    const workflow = String(process.env.GITHUB_REFRESH_MARKET_WORKFLOW || 'refresh-market-board.yml').trim() || 'refresh-market-board.yml'
    const ref = String(process.env.GITHUB_REF || 'main').trim() || 'main'
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`
    const gh = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    })
    if (!gh.ok) {
      const body = await gh.text().catch(() => '')
      res.status(502).json({ success: false, error: 'github_dispatch_failed', message: `GitHub workflow_dispatch 触发失败：HTTP ${gh.status} ${body}` })
      return
    }
    res.status(202).json({ success: true, message: '已触发大盘看板后台刷新任务（GitHub Actions）。' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: 'internal_error', message: msg })
  }
})

export default router
