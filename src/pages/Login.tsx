import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '@/utils/apiBase'
import { getAuthSession, setCachedAuthSession } from '@/utils/authSession'

type LoginPhase = 'checking' | 'ready' | 'submitting' | 'redirecting'

export default function Login() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [phase, setPhase] = useState<LoginPhase>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        setPhase('checking')
        setError(null)
        const session = await getAuthSession()
        if (cancelled) return
        if (session.authenticated) {
          setPhase('redirecting')
          const target = session.forcePasswordChange
            ? `/change-password?next=${encodeURIComponent(next)}`
            : next
          nav(target, { replace: true })
          return
        }
      } catch {
        void 0
      }
      setPhase('ready')
    })()

    return () => {
      cancelled = true
    }
  }, [nav, next])

  const isBusy = phase === 'checking' || phase === 'submitting' || phase === 'redirecting'

  const statusText = useMemo(() => {
    if (phase === 'checking') return '正在检查登录状态...'
    if (phase === 'submitting') return '正在验证账号密码并建立会话...'
    if (phase === 'redirecting') return '登录成功，正在进入系统...'
    return error || '请输入管理员分配的账号和密码登录'
  }, [error, phase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy) return
    const trimmedUsername = username.trim().toLowerCase()
    if (!trimmedUsername || !password) {
      setError('请输入账号和密码')
      return
    }

    setPhase('submitting')
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
          remember,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string
            session?: {
              authenticated: boolean
              username: string | null
              role?: 'admin' | 'user' | null
              forcePasswordChange?: boolean
              status?: 'active' | 'disabled' | null
            }
          }
        | null
      if (!response.ok || !payload?.session?.authenticated) {
        setPassword('')
        setPhase('ready')
        setError(payload?.message || `HTTP ${response.status}`)
        return
      }
      const session = {
        authenticated: true,
        username: payload.session.username,
        role: payload.session.role || null,
        forcePasswordChange: payload.session.forcePasswordChange === true,
        status: payload.session.status || 'active',
      } as const
      setCachedAuthSession(session)
      setPhase('redirecting')
      const target = session.forcePasswordChange
        ? `/change-password?next=${encodeURIComponent(next)}`
        : next
      nav(target, { replace: true })
    } catch (submitError) {
      setPassword('')
      setPhase('ready')
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    }
  }

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
            <div className="relative min-h-[432px] overflow-hidden rounded-2xl border border-[rgba(230,81,0,0.15)] bg-[rgba(13,26,28,0.85)] p-12 shadow-[0_0_50px_-15px_rgba(230,81,0,0.25)] backdrop-blur-[24px]">
              <div className="pointer-events-none absolute right-10 top-[-40px] h-32 w-32 rounded-xl bg-[rgba(230,81,0,0.2)] blur-[60px]" />

              <div className="flex flex-col items-center gap-2">
                <div className="text-xl font-bold leading-[1.4] text-white">安全登录</div>
                <div className="text-xs leading-[1.3333] text-[#64748B]">请输入系统账号与密码，开启您的智能量化分析之旅</div>
              </div>

              <form className="mt-8 flex flex-col gap-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                      账号
                    </label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-[rgba(255,138,80,0.55)] focus:ring-2 focus:ring-[rgba(255,138,80,0.2)]"
                      placeholder="请输入账号"
                      disabled={isBusy}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                      密码
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 pr-12 text-sm text-white outline-none transition focus:border-[rgba(255,138,80,0.55)] focus:ring-2 focus:ring-[rgba(255,138,80,0.2)]"
                        placeholder="请输入密码"
                        disabled={isBusy}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-[#94A3B8] transition hover:text-white"
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                        disabled={isBusy}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="inline-flex items-center gap-2 text-[11px] leading-[1.5] text-[#64748B]">
                    <span className="relative inline-flex h-4 w-4 items-center justify-center rounded border border-[#E65100]">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        disabled={isBusy}
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
                  <div className="text-[11px] text-[#64748B]">默认管理员首登后需立即改密</div>
                </div>

                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#FF8A50_0%,#E65100_100%)] px-4 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isBusy}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {phase === 'submitting' ? '登录中...' : '账号密码登录'}
                </button>

                <div className="border-t border-[rgba(255,255,255,0.05)] pt-6 text-center text-[10px] uppercase tracking-[0.05em] text-[#475569]">
                  SECURE ACCESS · DATA ENCRYPTED
                </div>

                <div
                  className={`min-h-[74px] rounded-lg px-3 py-2 text-xs ${
                    error
                      ? 'border border-[#EF4444]/40 bg-black/10 text-[#A9B6CC]'
                      : 'border border-[rgba(255,255,255,0.08)] bg-black/10 text-[#A9B6CC]'
                  }`}
                >
                  <div className={error ? 'text-[#E6EDF7]' : 'text-[#CBD5E1]'}>{error ? '登录失败' : '登录状态'}</div>
                  <div className="mt-1">{statusText}</div>
                </div>
              </form>
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
