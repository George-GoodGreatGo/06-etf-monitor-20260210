import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '@/utils/apiBase'

export default function Login() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/'

  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)
  const rememberRef = useRef(true)

  useEffect(() => {
    rememberRef.current = remember
  }, [remember])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { cache: 'no-store', credentials: 'include' })
        const j = (await res.json().catch(() => null)) as unknown
        const authed = Boolean(j && typeof j === 'object' && (j as Record<string, unknown>).authenticated === true)
        if (authed) {
          nav(next, { replace: true })
          return
        }
      } catch {
        void 0
      }

      const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
      if (!clientId) {
        setError('缺少 VITE_GOOGLE_CLIENT_ID')
        return
      }
      if (initializedRef.current) return
      initializedRef.current = true

      const init = () => {
        const g = (window as any).google
        const el = buttonRef.current
        if (!g || !g.accounts || !g.accounts.id || !el) return

        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: { credential?: string }) => {
            const credential = typeof resp?.credential === 'string' ? resp.credential : ''
            if (!credential) return
            setLoading(true)
            setError(null)
            try {
              const r = await fetch(apiUrl('/api/auth/google'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential, remember: rememberRef.current }),
                credentials: 'include',
              })
              const j = (await r.json().catch(() => null)) as unknown
              if (!r.ok) {
                const msg =
                  j && typeof j === 'object' && (j as Record<string, unknown>).message
                    ? String((j as Record<string, unknown>).message)
                    : `HTTP ${r.status}`
                throw new Error(msg)
              }
              nav(next, { replace: true })
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            } finally {
              setLoading(false)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        el.innerHTML = ''
        g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 320 })
      }

      if ((window as any).google?.accounts?.id) {
        init()
        return
      }

      const existing = document.querySelector('script[data-google-gsi="1"]') as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', init, { once: true })
        return
      }

      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.dataset.googleGsi = '1'
      s.addEventListener('load', init, { once: true })
      s.addEventListener('error', () => setError('加载 Google 登录组件失败'), { once: true })
      document.head.appendChild(s)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-[#111B2E] p-5">
        <div className="text-lg font-semibold tracking-tight">登录</div>
        <div className="mt-1 text-xs text-[#A9B6CC]">仅白名单邮箱可访问</div>

        <div className="mt-5 space-y-3">
          <label className="flex items-center gap-2 text-xs text-[#A9B6CC]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/20"
            />
            7天内保持登录状态
          </label>

          <div className="flex justify-center">
            <div ref={buttonRef} />
          </div>

          {error ? (
            <div className="rounded-lg border border-[#EF4444]/40 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
              <div className="text-[#E6EDF7]">登录失败</div>
              <div className="mt-0.5">{error}</div>
            </div>
          ) : null}

          {loading ? (
            <div className="text-center text-xs text-[#A9B6CC]">登录中…</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
