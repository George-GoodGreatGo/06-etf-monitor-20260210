import { Router } from 'express'
import { newYorkDate, readUsStyleSnapshot } from '../lib/usMarketStyle.js'
import { isCurrentUsStyleSnapshot } from '../../src/utils/usMarketStyle.js'
import { getUsMarketRefreshRun, RefreshError, startUsMarketRefresh } from '../lib/usMarketRefresh.js'

const router = Router()
router.post('/refresh', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  // Reject cross-site browser submissions while allowing the configured separate frontend.
  const origin = req.get('origin')
  const allowed = process.env.FRONTEND_ORIGIN?.trim()
  if ((req.get('sec-fetch-site') === 'cross-site' && origin !== allowed)
    || !req.is('application/json')) {
    res.status(403).json({ success: false, message: '更新请求来源无效。' })
    return
  }
  try {
    const snapshot = await readUsStyleSnapshot()
    const ticket = await startUsMarketRefresh(snapshot?.fetchedAt ?? null)
    res.status(202).json({ success: true, data: { ticket }, message: '更新任务已提交，正在等待 GitHub Actions。' })
  } catch (error) {
    res.status(error instanceof RefreshError ? error.status : 502).json({
      success: false, message: error instanceof RefreshError ? error.message : '提交更新任务失败，请稍后重试。',
    })
  }
})
router.get('/refresh/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (typeof req.query.ticket !== 'string' || req.query.ticket.length > 2000) throw new RefreshError('任务标识无效。', 400)
    const { value, run } = await getUsMarketRefreshRun(req.query.ticket)
    if (!run || run.status !== 'completed') {
      res.json({ success: true, data: { state: run?.status === 'in_progress' ? 'running' : 'queued', runUrl: run?.html_url } })
      return
    }
    if (run.conclusion !== 'success') {
      res.json({ success: true, data: { state: 'failed', runUrl: run.html_url, message: `GitHub 更新任务未成功（${run.conclusion || 'unknown'}），原数据保持不变。` } })
      return
    }
    const snapshot = await readUsStyleSnapshot()
    if (!snapshot || !isCurrentUsStyleSnapshot(snapshot)
      || Date.parse(snapshot.fetchedAt) <= Math.max(Date.parse(value.baseline || '') || 0, value.startedAt)) {
      res.json({ success: true, data: { state: 'publishing', runUrl: run.html_url } })
      return
    }
    const ageDays = (Date.parse(newYorkDate()) - Date.parse(snapshot.dataDate)) / 86_400_000
    res.json({ success: true, data: { state: 'success', snapshot, stale: ageDays > 7, runUrl: run.html_url } })
  } catch (error) {
    res.status(error instanceof RefreshError ? error.status : 502).json({
      success: false, message: error instanceof RefreshError ? error.message : '查询更新进度失败，请稍后刷新读取。',
    })
  }
})
router.get('/panel', async (_req, res) => {
  try {
    const snapshot = await readUsStyleSnapshot()
    res.setHeader('Cache-Control', 'no-store')
    if (!snapshot) {
      res.status(503).json({ success: false, message: '美股市场风格数据尚未初始化，请运行数据更新任务。' })
      return
    }
    if (!isCurrentUsStyleSnapshot(snapshot)) {
      res.status(503).json({ success: false, message: '当前快照仍为旧基准或不完整。请执行 0022 迁移并刷新 VOO 基准数据。' })
      return
    }
    const ageDays = (Date.parse(newYorkDate()) - Date.parse(snapshot.dataDate)) / 86_400_000
    res.json({ success: true, data: snapshot, stale: ageDays > 7 })
  } catch (error) {
    console.error('[us-style] read failed', error instanceof Error ? error.message : String(error))
    res.status(502).json({ success: false, message: '美股市场风格数据读取失败，请稍后重试。' })
  }
})
export default router
