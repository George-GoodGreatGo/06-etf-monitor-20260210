import { Router } from 'express'
import { newYorkDate, readUsStyleSnapshot } from '../lib/usMarketStyle.js'
import { isCurrentUsStyleSnapshot } from '../../src/utils/usMarketStyle.js'

const router = Router()
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
