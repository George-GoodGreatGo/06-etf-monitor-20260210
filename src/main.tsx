import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const BOOT_GUARD_MS = 12_000
type BootPhase = 'booting' | 'mounted' | 'failed'
const bootState: { phase: BootPhase; startedAt: number; shown: boolean } = {
  phase: 'booting',
  startedAt: Date.now(),
  shown: false,
}

function toSafeDetail(input: unknown): string {
  if (input == null) return ''
  let raw = ''
  if (input instanceof Error) raw = input.message || input.name || ''
  else if (typeof input === 'string') raw = input
  else {
    try {
      raw = JSON.stringify(input)
    } catch {
      raw = String(input)
    }
  }
  return raw.replace(/[<>]/g, '').slice(0, 220)
}

function canShowBootFallback(): boolean {
  if (bootState.phase !== 'booting') return false
  if (Date.now() - bootState.startedAt > BOOT_GUARD_MS) return false
  const root = document.getElementById('root')
  return Boolean(root && root.childElementCount === 0)
}

function shouldIgnoreGlobalRejection(name: string, msg: string): boolean {
  if (name === 'AbortError') return true
  const lower = msg.toLowerCase()
  if (lower.includes('aborted') || lower.includes('net::err_aborted')) return true
  if (lower.includes('resizeobserver loop limit exceeded')) return true
  if (lower.includes('script error')) return true
  return false
}

function logBootEvent(event: Record<string, unknown>) {
  console.warn('[boot-guard]', {
    ts: new Date().toISOString(),
    phase: bootState.phase,
    elapsedMs: Date.now() - bootState.startedAt,
    ...event,
  })
}

function showBootFallback(reason: 'BOOT_ERR' | 'BOOT_REJECT' | 'BOOT_INIT', detail?: unknown) {
  if (!canShowBootFallback()) {
    logBootEvent({ action: 'skip-fallback', reason, detail: toSafeDetail(detail) })
    return
  }
  if (bootState.shown) return
  bootState.shown = true
  bootState.phase = 'failed'

  const root = document.getElementById('root')
  if (!root) return
  const safe = toSafeDetail(detail)
  logBootEvent({ action: 'show-fallback', reason, detail: safe })
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050A0B;color:#E6EDF7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px;text-align:center;line-height:1.6;">
        <div style="font-size:20px;font-weight:700;">页面加载失败</div>
        <div style="margin-top:8px;color:#A9B6CC;">请刷新页面重试；若仍失败，请稍后重试或联系管理员。</div>
        <div style="margin-top:6px;font-size:12px;color:#64748B;">原因码：${reason}</div>
        ${safe ? `<div style="margin-top:10px;font-size:12px;color:#64748B;word-break:break-word;">${safe}</div>` : ''}
      </div>
    </div>
  `
}

function scheduleBootFallback(source: 'error' | 'rejection', detail?: unknown) {
  if (!canShowBootFallback()) {
    logBootEvent({ action: 'skip-schedule', source, detail: toSafeDetail(detail) })
    return
  }
  window.setTimeout(() => {
    if (!canShowBootFallback()) {
      logBootEvent({ action: 'skip-delayed', source, detail: toSafeDetail(detail) })
      return
    }
    showBootFallback(source === 'error' ? 'BOOT_ERR' : 'BOOT_REJECT', detail)
  }, 120)
}

function attachBootGlobalGuards() {
  window.addEventListener(
    'error',
    (event) => {
      const msg = event?.error instanceof Error ? event.error.message : String(event?.message || '')
      scheduleBootFallback('error', msg)
    },
    true,
  )

  window.addEventListener('unhandledrejection', (event) => {
    const r = event.reason as unknown
    const name =
      typeof r === 'object' && r !== null && 'name' in r ? String((r as Record<string, unknown>).name) : ''
    const msg = toSafeDetail(r)
    if (shouldIgnoreGlobalRejection(name, msg)) {
      event.preventDefault()
      logBootEvent({ action: 'ignore-rejection', name, detail: msg })
      return
    }
    scheduleBootFallback('rejection', msg)
  })
}

function markBootMountedWhenReady(root: HTMLElement) {
  const mark = () => {
    if (bootState.phase !== 'booting') return
    bootState.phase = 'mounted'
    logBootEvent({ action: 'mark-mounted' })
  }
  if (root.childElementCount > 0) {
    mark()
    return
  }
  const obs = new MutationObserver(() => {
    if (root.childElementCount > 0) {
      obs.disconnect()
      mark()
    }
  })
  obs.observe(root, { childList: true })
  window.setTimeout(() => {
    obs.disconnect()
    mark()
  }, BOOT_GUARD_MS)
}

attachBootGlobalGuards()

try {
  const root = document.getElementById('root')
  if (!root) throw new Error('missing #root')
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  markBootMountedWhenReady(root)
} catch (e) {
  showBootFallback('BOOT_INIT', e)
}
