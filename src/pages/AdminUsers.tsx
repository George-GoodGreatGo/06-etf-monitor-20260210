import { Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldAlert, UserCog } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAdminUser, fetchAdminUsers, resetAdminUserPassword, updateAdminUserStatus, type ManagedAuthUser } from '@/utils/adminApi'
import PageContentContainer from '@/components/PageContentContainer'
import { parseIsoToLocal } from '@/utils/format'

type GeneratedPasswordNotice = {
  username: string
  temporaryPassword: string
  scene: 'create' | 'reset'
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return parseIsoToLocal(value) || value
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ManagedAuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
  const [notice, setNotice] = useState<GeneratedPasswordNotice | null>(null)
  const [copied, setCopied] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextUsers = await fetchAdminUsers()
      setUsers(nextUsers)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const activeAdmins = useMemo(
    () => users.filter((user) => user.role === 'admin' && user.status === 'active').length,
    [users],
  )

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createAdminUser({
        username: newUsername.trim(),
        role: newRole,
      })
      setNewUsername('')
      setNewRole('user')
      setNotice({
        username: result.user.username,
        temporaryPassword: result.temporaryPassword,
        scene: 'create',
      })
      setCopied(false)
      await loadUsers()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (username: string) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await resetAdminUserPassword(username)
      setNotice({
        username: result.user.username,
        temporaryPassword: result.temporaryPassword,
        scene: 'reset',
      })
      setCopied(false)
      await loadUsers()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (user: ManagedAuthUser) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await updateAdminUserStatus({
        username: user.username,
        status: user.status === 'active' ? 'disabled' : 'active',
      })
      await loadUsers()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const copyNoticePassword = async () => {
    if (!notice) return
    try {
      await navigator.clipboard.writeText(notice.temporaryPassword)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <PageContentContainer className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[rgba(13,26,28,0.78)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,138,80,0.22)] bg-[rgba(255,138,80,0.08)] px-3 py-1 text-xs font-semibold text-[#FFB08A]">
              <UserCog className="h-3.5 w-3.5" />
              管理员用户
            </div>
            <h1 className="text-2xl font-bold text-white">账号管理后台</h1>
            <p className="max-w-[760px] text-sm leading-6 text-[#94A3B8]">
              仅管理员可访问。支持创建账号、生成随机初始密码、重置密码、启用或禁用账号。随机密码只在当前操作后展示一次。
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              启用管理员：<span className="font-semibold text-white">{activeAdmins}</span>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[#E6EDF7] transition hover:bg-white/10"
              onClick={() => void loadUsers()}
              disabled={loading || submitting}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新列表
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <form
            className="rounded-3xl border border-white/10 bg-[rgba(13,26,28,0.78)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
            onSubmit={handleCreate}
          >
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4 text-[#FF8A50]" />
              新建账号
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">账号</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-[rgba(255,138,80,0.55)] focus:ring-2 focus:ring-[rgba(255,138,80,0.2)]"
                  placeholder="如 analyst01"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">角色</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value === 'admin' ? 'admin' : 'user')}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-[rgba(255,138,80,0.55)] focus:ring-2 focus:ring-[rgba(255,138,80,0.2)]"
                  disabled={submitting}
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#FF8A50_0%,#E65100_100%)] px-4 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                创建账号并生成随机密码
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-[rgba(255,138,80,0.18)] bg-[rgba(255,138,80,0.08)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-[#FFB08A]" />
              随机密码展示区
            </div>
            {notice ? (
              <div className="space-y-4">
                <div className="text-sm leading-6 text-[#E6EDF7]">
                  {notice.scene === 'create' ? '新账号已创建。' : '密码已重置。'}
                  请立即复制并通过安全渠道发送给账号 <span className="font-semibold text-white">{notice.username}</span>。
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">临时密码</div>
                  <div className="break-all font-mono text-sm text-[#FFEDD5]">{notice.temporaryPassword}</div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[#E6EDF7] transition hover:bg-white/10"
                  onClick={() => void copyNoticePassword()}
                >
                  <Copy className="h-4 w-4" />
                  {copied ? '已复制' : '复制随机密码'}
                </button>
              </div>
            ) : (
              <div className="text-sm leading-6 text-[#A9B6CC]">创建账号或重置密码后，随机密码会只在这里展示一次，不会在列表中回显。</div>
            )}
          </div>

          {error ? (
            <div className="rounded-2xl border border-[#EF4444]/35 bg-[#2A0D10]/60 px-4 py-3 text-sm text-[#FECACA]">{error}</div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-[rgba(13,26,28,0.78)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">用户列表</div>
            <div className="text-xs text-[#94A3B8]">共 {users.length} 个账号</div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-[#A9B6CC]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载用户列表...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-[0.08em] text-[#94A3B8]">
                    <th className="px-3 py-3">账号</th>
                    <th className="px-3 py-3">角色</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">需改密</th>
                    <th className="px-3 py-3">最近登录</th>
                    <th className="px-3 py-3">密码更新时间</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.username} className="border-b border-white/[0.06] text-[#E6EDF7]">
                      <td className="px-3 py-4 font-mono text-xs sm:text-sm">{user.username}</td>
                      <td className="px-3 py-4">
                        <span className="rounded-full border border-white/10 px-2 py-1 text-xs uppercase tracking-[0.08em] text-[#CBD5E1]">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            user.status === 'active'
                              ? 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                              : 'border border-rose-400/25 bg-rose-500/10 text-rose-300'
                          }`}
                        >
                          {user.status === 'active' ? '启用中' : '已禁用'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-xs text-[#CBD5E1]">{user.forcePasswordChange ? '是' : '否'}</td>
                      <td className="px-3 py-4 text-xs text-[#CBD5E1]">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="px-3 py-4 text-xs text-[#CBD5E1]">{formatDateTime(user.passwordChangedAt)}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-[#E6EDF7] transition hover:bg-white/10"
                            onClick={() => void handleResetPassword(user.username)}
                            disabled={submitting}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            重置密码
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-[#E6EDF7] transition hover:bg-white/10 disabled:opacity-60"
                            onClick={() => void handleToggleStatus(user)}
                            disabled={submitting}
                          >
                            {user.status === 'active' ? '禁用' : '启用'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-12 text-center text-sm text-[#94A3B8]">
                        暂无用户数据
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </PageContentContainer>
  )
}
