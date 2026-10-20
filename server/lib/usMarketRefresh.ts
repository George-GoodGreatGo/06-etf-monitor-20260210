import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

type Ticket = { requestId: string; startedAt: number; baseline: string | null }
type Run = { id: number; display_title: string; status: string; conclusion: string | null; html_url: string }
export class RefreshError extends Error {
  constructor(message: string, public status = 502) { super(message) }
}

function config() {
  const token = process.env.GITHUB_ACTIONS_TOKEN?.trim()
  const owner = process.env.GITHUB_OWNER?.trim()
  const repo = process.env.GITHUB_REPO?.trim()
  if (!token || !owner || !repo) throw new RefreshError('尚未配置 GitHub Actions 更新凭据，请联系管理员。', 503)
  const workflow = process.env.GITHUB_US_MARKET_STYLE_WORKFLOW?.trim() || 'refresh-us-market-style.yml'
  return { token, owner, repo, workflow, ref: process.env.GITHUB_REF?.trim() || 'main' }
}

async function github(path: string, body?: unknown) {
  const c = config()
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new RefreshError(`GitHub 更新请求失败（HTTP ${response.status}），请检查工作流及令牌的 Actions 读写权限。`)
  return response.status === 204 ? null : response.json()
}

function sign(payload: string) {
  return createHmac('sha256', config().token).update(payload).digest('base64url')
}

export function decodeRefreshTicket(ticket: string): Ticket {
  const [payload, signature, extra] = ticket.split('.')
  const expected = sign(payload || '')
  if (!signature || extra || signature.length !== expected.length
    || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new RefreshError('更新任务标识无效。', 400)
  }
  let value: Ticket
  try { value = JSON.parse(Buffer.from(payload, 'base64url').toString()) } catch { throw new RefreshError('更新任务标识无效。', 400) }
  if (typeof value.requestId !== 'string' || !Number.isFinite(value.startedAt)
    || Date.now() - value.startedAt > 30 * 60_000 || value.startedAt > Date.now() + 60_000
    || (value.baseline !== null && typeof value.baseline !== 'string')) {
    throw new RefreshError('任务跟踪已过期，请刷新读取数据或前往 GitHub 查看任务。', 400)
  }
  return value
}

let dispatching = false
let recent: { ticket: string; at: number } | null = null

export async function startUsMarketRefresh(baseline: string | null) {
  config()
  // Coalesce rapid clicks on this instance; workflow concurrency also serializes publishers.
  if (recent && Date.now() - recent.at < 60_000) return recent.ticket
  if (dispatching) throw new RefreshError('更新请求正在提交，请稍后再试。', 429)
  dispatching = true
  try {
    const c = config()
    const value: Ticket = { requestId: randomUUID(), startedAt: Date.now(), baseline }
    await github(`actions/workflows/${encodeURIComponent(c.workflow)}/dispatches`, {
      ref: c.ref, inputs: { request_id: value.requestId },
    })
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
    const ticket = `${payload}.${sign(payload)}`
    recent = { ticket, at: Date.now() }
    return ticket
  } finally { dispatching = false }
}

export async function getUsMarketRefreshRun(ticket: string) {
  const value = decodeRefreshTicket(ticket)
  const c = config()
  const query = new URLSearchParams({ event: 'workflow_dispatch', per_page: '100',
    created: `>=${new Date(value.startedAt - 60_000).toISOString()}` })
  const result = await github(`actions/workflows/${encodeURIComponent(c.workflow)}/runs?${query}`)
  const run = (result.workflow_runs as Run[]).find((r) => r.display_title === `US market style ${value.requestId}`)
  if (!run && Date.now() - value.startedAt > 5 * 60_000) {
    throw new RefreshError('未能找到对应任务，请前往 GitHub Actions 核查，或稍后刷新读取。')
  }
  return { value, run }
}
