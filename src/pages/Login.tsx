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

  const initializedRef = useRef(false)
  const gsiBtnRef = useRef<HTMLDivElement | null>(null)
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
        if (!g || !g.accounts || !g.accounts.id) return

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

        const el = gsiBtnRef.current
        if (el) {
          el.innerHTML = ''
          g.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', width: 302 })
        }
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
    <div className="relative min-h-screen overflow-hidden bg-[#050A0B] text-[#E6EDF7]">
      <img
        src="/figma/login/login_bg_mask.svg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        aria-hidden="true"
      />
      <img
        src="/figma/login/login_bg_bottom.svg"
        alt=""
        className="pointer-events-none absolute bottom-0 left-0 right-0 w-full select-none"
        aria-hidden="true"
      />
      <header className="mx-auto w-full max-w-[1280px] px-8 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/figma/login/login_logo.svg"
              alt=""
              className="h-8 w-8 select-none"
              aria-hidden="true"
            />
            <div className="text-sm font-black uppercase tracking-[0.1em]">ETF Monitor AI</div>
          </div>
          <div className="text-[10px] font-medium tracking-[-0.05em] text-[#64748B]">
            DESIGNED BY GEORGE.LI · 南海之滨的AI爱好者
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-6 pb-20 pt-24">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <section className="mx-auto w-full max-w-[616px] space-y-8">
            <div className="inline-flex items-center rounded-xl border border-[rgba(230,81,0,0.2)] bg-[rgba(230,81,0,0.1)] px-3 py-1">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#E65100]">Data Horizon</span>
            </div>
            <h1 className="text-left text-[42px] font-black leading-[1.05] text-transparent md:text-[60px] bg-clip-text bg-[linear-gradient(169deg,#FFFFFF_0%,#FF8A50_100%)]">
              洞察金融数据
              <br />
              预见增长机遇
            </h1>
            <p className="max-w-[448px] text-base leading-[1.625] text-[#94A3B8]">
              专为金融分析师打造的高效决策引擎。深耕数据海洋，以 AI 赋能精准投研。
            </p>

            <div className="grid w-full max-w-[448px] grid-cols-2 gap-4">
              {[
                { icon: '/figma/login/login_feature1.svg', label: '自动抓取' },
                { icon: '/figma/login/login_feature2.svg', label: 'AI 智能解读' },
                { icon: '/figma/login/login_feature3.svg', label: '估值监控' },
                { icon: '/figma/login/login_feature4.svg', label: '策略预警' },
              ].map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-3 rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-3"
                >
                  <img src={t.icon} alt="" className="h-4 w-4 select-none" aria-hidden="true" />
                  <div className="text-xs font-bold text-[#E2E8F0]">{t.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[398px]">
            <div className="relative overflow-hidden rounded-2xl border border-[rgba(230,81,0,0.15)] bg-[rgba(13,26,28,0.85)] p-12 shadow-[0_0_50px_-15px_rgba(230,81,0,0.25)] backdrop-blur-[24px]">
              <div className="pointer-events-none absolute right-10 top-[-40px] h-32 w-32 rounded-xl bg-[rgba(230,81,0,0.2)] blur-[60px]" />

              <div className="flex flex-col items-center gap-2">
                <div className="text-xl font-bold leading-[1.4] text-white">安全登录</div>
                <div className="text-xs leading-[1.3333] text-[#64748B]">开启您的智能量化分析之旅</div>
              </div>

              <div className="mt-8 flex flex-col gap-6">
                <div className="relative">
                  <button
                    type="button"
                    disabled={loading}
                    className="relative inline-flex h-14 w-full items-center justify-center gap-3 rounded-md bg-[#E65100] px-6 text-base font-bold text-white shadow-[0px_4px_6px_-4px_rgba(230,81,0,0.2),0px_10px_15px_-3px_rgba(230,81,0,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <img
                      src="/figma/login/login_google_icon.svg"
                      alt=""
                      className="h-5 w-5 select-none"
                      aria-hidden="true"
                    />
                    通过 Google 账号登录
                  </button>
                  <div
                    ref={gsiBtnRef}
                    className={loading ? 'pointer-events-none absolute inset-0 opacity-0' : 'absolute inset-0 opacity-0'}
                  />
                </div>

                <label className="flex items-center justify-center gap-2 text-[11px] leading-[1.5] text-[#64748B]">
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded border border-[#E65100]">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    {remember ? (
                      <img
                        src="/figma/login/login_check.svg"
                        alt=""
                        className="h-4 w-4 select-none"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  保持 7 天内登录状态
                </label>

                <div className="border-t border-[rgba(255,255,255,0.05)] pt-6 text-center text-[10px] uppercase tracking-[0.05em] text-[#475569]">
                  SECURE ACCESS · DATA ENCRYPTED
                </div>

                {error ? (
                  <div className="rounded-lg border border-[#EF4444]/40 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
                    <div className="text-[#E6EDF7]">登录失败</div>
                    <div className="mt-0.5">{error}</div>
                  </div>
                ) : null}

                {loading ? <div className="text-center text-xs text-[#A9B6CC]">登录中…</div> : null}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1280px] border-t border-[rgba(255,255,255,0.05)] px-8 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-6 text-xs text-[#64748B]">
            <span>© 2024 ETF Monitor AI. 保留所有权利.</span>
            <span className="text-[#1E293B]">|</span>
            <span className="text-[#94A3B8]">George.LI , 一位来自南海之滨的AI爱好者</span>
          </div>
          <a href="mailto:gzliyuxin@gmail.com" className="inline-flex items-center gap-2 text-xs font-medium text-[#E65100]">
            <img src="/figma/login/login_email.svg" alt="" className="h-3 w-3 select-none" aria-hidden="true" />
            gzliyuxin@gmail.com
          </a>
        </div>
      </footer>
    </div>
  )
}
