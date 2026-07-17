import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '@/utils/apiBase'
import { getAuthSession, setCachedAuthSession } from '@/utils/authSession'

type ChangePasswordPhase = 'checking' | 'ready' | 'submitting' | 'redirecting'

export default function ChangePassword() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') || '/'

  const [phase, setPhase] = useState<ChangePasswordPhase>('checking')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const session = await getAuthSession({ forceRefresh: true })
        if (cancelled) return
        if (!session.authenticated) {
          nav(`/login?next=${encodeURIComponent(next)}`, { replace: true })
          return
        }
        setUsername(session.username)
        if (!session.forcePasswordChange) {
          nav(next, { replace: true })
          return
        }
        setPhase('ready')
      } catch {
        if (cancelled) return
        nav(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nav, next])

  const isBusy = phase === 'checking' || phase === 'submitting' || phase === 'redirecting'

  const statusText = useMemo(() => {
    if (phase === 'checking') return '正在校验当前登录态...'
    if (phase === 'submitting') return '正在更新密码并刷新会话...'
    if (phase === 'redirecting') return '密码修改成功，正在进入系统...'
    return error || '首次登录或管理员重置密码后，需要先修改密码'
  }, [error, phase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请完整填写密码信息')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    setPhase('submitting')
    setError(null)
    try {
      const response = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
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
        setPhase('ready')
        setError(payload?.message || `HTTP ${response.status}`)
        return
      }
      setCachedAuthSession({
        authenticated: true,
        username: payload.session.username,
        role: payload.session.role || null,
        forcePasswordChange: payload.session.forcePasswordChange === true,
        status: payload.session.status || 'active',
      })
      setPhase('redirecting')
      nav(next, { replace: true })
    } catch (submitError) {
      setPhase('ready')
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    }
  }

  const inputBaseClassName =
    'h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-[rgba(255,138,80,0.55)] focus:ring-2 focus:ring-[rgba(255,138,80,0.2)]'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050A0B] text-[#E6EDF7]">
      <img
        src="/figma/login/login_bg_mask.svg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        aria-hidden="true"
      />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1280px] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[520px] rounded-3xl border border-[rgba(230,81,0,0.16)] bg-[rgba(13,26,28,0.88)] p-8 shadow-[0_0_60px_-18px_rgba(230,81,0,0.3)] backdrop-blur-[24px] sm:p-10">
          <div className="mb-8 flex items-start gap-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(230,81,0,0.12)] text-[#FF8A50]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-white">首次登录请修改密码</div>
              <div className="text-sm leading-6 text-[#94A3B8]">
                {username ? `当前账号：${username}` : '当前账号已登录'}
                ，完成修改后才可进入系统。
              </div>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">当前密码</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className={`${inputBaseClassName} pr-12`}
                  placeholder="请输入当前密码"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-[#94A3B8] transition hover:text-white"
                  aria-label={showCurrentPassword ? '隐藏当前密码' : '显示当前密码'}
                  disabled={isBusy}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">新密码</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBaseClassName} pr-12`}
                  placeholder="至少 12 位，包含大小写字母、数字和特殊字符"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-[#94A3B8] transition hover:text-white"
                  aria-label={showNewPassword ? '隐藏新密码' : '显示新密码'}
                  disabled={isBusy}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">确认新密码</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputBaseClassName} pr-12`}
                  placeholder="请再次输入新密码"
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-[#94A3B8] transition hover:text-white"
                  aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                  disabled={isBusy}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-black/10 px-4 py-3 text-xs leading-6 text-[#A9B6CC]">
              <div className="font-semibold text-[#E6EDF7]">密码规则</div>
              <div>长度至少 12 位，需同时包含大写字母、小写字母、数字和特殊字符。</div>
            </div>

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#FF8A50_0%,#E65100_100%)] px-4 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {phase === 'submitting' ? '保存中...' : '保存新密码并进入系统'}
            </button>
          </form>

          <div
            className={`mt-6 min-h-[74px] rounded-2xl px-4 py-3 text-xs ${
              error
                ? 'border border-[#EF4444]/40 bg-black/10 text-[#A9B6CC]'
                : 'border border-[rgba(255,255,255,0.08)] bg-black/10 text-[#A9B6CC]'
            }`}
          >
            <div className={error ? 'text-[#E6EDF7]' : 'text-[#CBD5E1]'}>{error ? '修改失败' : '当前状态'}</div>
            <div className="mt-1">{statusText}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
