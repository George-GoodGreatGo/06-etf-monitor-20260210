import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

function showBootFallback(detail?: string) {
  const root = document.getElementById('root')
  if (!root || root.childElementCount > 0) return
  const safe = String(detail || '').slice(0, 220)
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050A0B;color:#E6EDF7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;text-align:center;line-height:1.6;">
        <div style="font-size:20px;font-weight:700;">页面加载失败</div>
        <div style="margin-top:8px;color:#A9B6CC;">请刷新页面重试；若仍失败，请升级 Safari 或 iPadOS 后再访问。</div>
        ${safe ? `<div style="margin-top:10px;font-size:12px;color:#64748B;word-break:break-word;">${safe}</div>` : ''}
      </div>
    </div>
  `
}

window.addEventListener(
  'error',
  (event) => {
    const msg = event?.error instanceof Error ? event.error.message : String(event?.message || '')
    showBootFallback(msg)
  },
  true,
)

window.addEventListener('unhandledrejection', (event) => {
  const r = event.reason as unknown
  const name =
    typeof r === 'object' && r !== null && 'name' in r ? String((r as Record<string, unknown>).name) : ''
  const msg =
    r instanceof Error ? r.message : typeof r === 'string' ? r : typeof r === 'object' ? JSON.stringify(r) : ''
  if (name === 'AbortError' || msg.toLowerCase().includes('aborted') || msg.includes('net::ERR_ABORTED')) {
    event.preventDefault()
    return
  }
  showBootFallback(msg)
})

try {
  const root = document.getElementById('root')
  if (!root) throw new Error('missing #root')
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  showBootFallback(e instanceof Error ? e.message : String(e))
}
