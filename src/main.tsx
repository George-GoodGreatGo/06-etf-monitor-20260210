import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

window.addEventListener('unhandledrejection', (event) => {
  const r = event.reason as unknown
  const name =
    typeof r === 'object' && r !== null && 'name' in r ? String((r as Record<string, unknown>).name) : ''
  const msg =
    r instanceof Error ? r.message : typeof r === 'string' ? r : typeof r === 'object' ? JSON.stringify(r) : ''
  if (name === 'AbortError' || msg.toLowerCase().includes('aborted') || msg.includes('net::ERR_ABORTED')) {
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
