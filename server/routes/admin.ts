import { Router, type Request, type Response } from 'express'

const router = Router()

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

type JsonOk = {
  success: true
  message: string
  github?: {
    owner: string
    repo: string
    workflow: string
    ref: string
  }
}

type JsonErr = {
  success: false
  error: string
  message: string
}

router.post('/refresh', async (req: Request, res: Response<JsonOk | JsonErr>) => {
  void req

  if (!process.env.VERCEL) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: '该接口仅用于 Vercel 线上环境；本地开发请直接使用本地重算模式。',
    })
    return
  }

  let token: string
  let owner: string
  let repo: string
  let workflow: string
  let ref: string
  try {
    token = mustEnv('GITHUB_ACTIONS_TOKEN')
    owner = mustEnv('GITHUB_OWNER')
    repo = mustEnv('GITHUB_REPO')
    workflow = String(process.env.GITHUB_REFRESH_WORKFLOW || 'refresh-top100.yml').trim() || 'refresh-top100.yml'
    ref = String(process.env.GITHUB_REF || 'main').trim() || 'main'
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'missing_env',
      message: e instanceof Error ? e.message : String(e),
    })
    return
  }

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
    res.status(502).json({
      success: false,
      error: 'github_dispatch_failed',
      message: `GitHub workflow_dispatch 触发失败：HTTP ${gh.status} ${body}`,
    })
    return
  }

  res.status(202).json({
    success: true,
    message: '已触发后台刷新任务（GitHub Actions）。通常需要 1-5 分钟写入快照。',
    github: { owner, repo, workflow, ref },
  })
})

router.post('/market/refresh', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  const token = String(req.header('x-admin-token') || '').trim()
  const expected = String(process.env.ADMIN_ACCESS_TOKEN || process.env.ADMIN_TOKEN || '').trim()
  if (!expected) {
    res.status(500).json({ success: false, error: 'missing_env', message: 'missing ADMIN_ACCESS_TOKEN (or ADMIN_TOKEN)' })
    return
  }
  if (!token || token !== expected) {
    res.status(401).json({ success: false, error: 'unauthorized' })
    return
  }
  void req
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
