import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import DataStatusBanner from '@/components/DataStatusBanner'
import { type SortDir } from '@/components/SortableTh'
import Top100FilterBar from '@/components/Top100FilterBar'
import Top100Table from '@/components/Top100Table'
import Top100InsightPanel from '@/components/Top100InsightPanel'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import {
  type EtfTopRow,
  type Top100Meta,
  fetchEtfTop100,
  type Top100SortKey,
} from '@/utils/etfApi'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'

const defaultSort: { key: Top100SortKey; dir: SortDir } = {
  key: 'turnover',
  dir: 'desc',
}

type HomeTab = 'list' | 'insight'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()

  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
  const debouncedKeyword = useDebouncedValue(keyword, 250)

  const rawTab = searchParams.get('tab')
  const tab: HomeTab = rawTab === 'insight' || rawTab === 'list' ? rawTab : 'list'

  const [sortKey, setSortKey] = useState<Top100SortKey>(
    (searchParams.get('sort') as Top100SortKey) ?? defaultSort.key,
  )
  const [sortDir, setSortDir] = useState<SortDir>(
    (searchParams.get('dir') as SortDir) ?? defaultSort.dir,
  )

  const [loading, setLoading] = useState(true)
  const [loadingMode, setLoadingMode] = useState<'fetch' | 'refetch' | 'cold'>('fetch')
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [rows, setRows] = useState<EtfTopRow[]>([])
  const [adminNotice, setAdminNotice] = useState<{ tone: 'info' | 'warn'; message: string } | null>(null)
  const [adminRefreshing, setAdminRefreshing] = useState(false)

  const metaRef = useRef<Top100Meta | null>(null)

  const [progressToken, setProgressToken] = useState<string | null>(null)
  const [backendProgressText, setBackendProgressText] = useState<string | null>(null)
  const [treatAsRefetch, setTreatAsRefetch] = useState(false)

  const activeRefetchTokenKey = 'etf_monitor_active_refetch_token'

  const refetchEtaMs = 180_000
  const refetchEtaSeconds = Math.round(refetchEtaMs / 1000)
  const [refetchStartedAt, setRefetchStartedAt] = useState<number | null>(null)
  const [refetchProgressPct, setRefetchProgressPct] = useState<number | null>(null)

  const reqSeqRef = useRef(0)
  const mountedRef = useRef(true)

  const bootIdRef = useRef<string | null>(null)
  const [isVercelBackend, setIsVercelBackend] = useState<boolean | null>(null)
  const initialLoadDoneRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    metaRef.current = meta
  }, [meta])


  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(apiUrl('/api/health'), { credentials: 'include', headers: { ...adminAuthHeaders() } })
        const j = (await res.json()) as unknown
        if (typeof j !== 'object' || j === null) return
        const bootId = (j as Record<string, unknown>).serverBootId
        if (typeof bootId !== 'string' || !bootId) return
        bootIdRef.current = bootId

        const v = (j as Record<string, unknown>).isVercel
        if (typeof v === 'boolean') setIsVercelBackend(v)
      } catch {
        return
      }
    }
    void run()
  }, [])

  useEffect(() => {
    if (rawTab === 'list' || rawTab === 'insight') return
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'list')
    setSearchParams(next, { replace: true })
  }, [rawTab, searchParams, setSearchParams])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (keyword.trim()) next.set('q', keyword.trim())
    else next.delete('q')
    next.set('tab', tab)
    next.set('sort', sortKey)
    next.set('dir', sortDir)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, sortKey, sortDir])

  const runFetch = async (
    seq: number,
    opts?: {
      refreshToken?: string
      mode?: 'fetch' | 'refetch' | 'cold'
      ensureLatest?: boolean
    },
  ) => {
    const mode = opts?.mode ?? (meta ? 'fetch' : 'cold')
    setLoading(true)
    setLoadingMode(mode)
    setError(null)

    const timeoutMs = mode === 'fetch' ? 120_000 : 900_000
    const ac = new AbortController()
    const timeoutId = window.setTimeout(() => ac.abort(), timeoutMs)

    let pToken: string | null = null
    if (mode === 'refetch') {
      pToken = opts?.refreshToken || String(Date.now())
    } else if (mode === 'cold') {
      pToken = String(Date.now())
    } else if (mode === 'fetch' && !meta) {
      pToken = String(Date.now())
    }

    setProgressToken(pToken)
    setBackendProgressText(null)
    setTreatAsRefetch(false)

    if (mode === 'refetch' || mode === 'cold') {
      const startedAt =
        mode === 'refetch' && opts?.refreshToken && /^\d+$/.test(opts.refreshToken)
          ? Number(opts.refreshToken)
          : Date.now()
      setRefetchStartedAt(startedAt)
      setRefetchProgressPct(0)
    }

    try {
      const res = await fetchEtfTop100(
        {
          limit: 200,
          refreshToken: opts?.refreshToken,
          ensureLatest: opts?.ensureLatest || opts?.mode === 'cold',
          progressToken: pToken || undefined,
        },
        ac.signal,
      )

      window.clearTimeout(timeoutId)

      if (!mountedRef.current || seq !== reqSeqRef.current) return

      if (res.success === false) {
        if (res.error === 'unauthorized') {
          nav(`/login?next=${encodeURIComponent('/' + window.location.search)}`, { replace: true })
          return
        }
        setMeta(null)
        setRows([])
        setError(res.message ?? res.error)
        setLoading(false)
        return
      }

      setMeta(res.meta)
      setRows(res.data)
      setLoading(false)
      setProgressToken(null)
      setBackendProgressText(null)
      if (mode === 'refetch' && opts?.refreshToken) {
        const active = window.localStorage.getItem(activeRefetchTokenKey)
        if (active && active === opts.refreshToken) {
          window.localStorage.removeItem(activeRefetchTokenKey)
        }
      }
    } catch {
      window.clearTimeout(timeoutId)
      if (!mountedRef.current || seq !== reqSeqRef.current) return
      setMeta(null)
      setRows([])
      setError(ac.signal.aborted ? '请求超时，请稍后重试' : '网络异常或 API 不可用')
      setLoading(false)
      setProgressToken(null)
      setBackendProgressText(null)
      if (mode === 'refetch' && opts?.refreshToken) {
        const active = window.localStorage.getItem(activeRefetchTokenKey)
        if (active && active === opts.refreshToken) {
          window.localStorage.removeItem(activeRefetchTokenKey)
        }
      }
    }
  }

  useEffect(() => {
    if (!loading) return
    if (loadingMode !== 'refetch' && loadingMode !== 'cold' && loadingMode !== 'fetch') return
    if (!progressToken) return

    let cancelled = false
    const bootingTimerId = window.setTimeout(() => {
      if (cancelled) return
      setBackendProgressText((prev) => prev || '后端计算启动中…')
    }, 3000)

    const tick = async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/etf/progress?_p=${encodeURIComponent(progressToken)}&_t=${Date.now()}`),
          { cache: 'no-store', credentials: 'include', headers: { ...adminAuthHeaders() } },
        )
        const j = (await res.json()) as unknown
        if (cancelled) return
        if (!j || typeof j !== 'object') return
        const o = j as Record<string, unknown>
        if (o.success !== true) return
        const data = o.data
        if (!data || typeof data !== 'object') return
        const d = data as Record<string, unknown>
        const stage = typeof d.stage === 'string' ? d.stage : null
        const msg = typeof d.message === 'string' ? d.message : null
        const done = typeof d.done === 'number' ? d.done : null
        const total = typeof d.total === 'number' ? d.total : null
        const text =
          msg && done != null && total != null && total > 0
            ? `${msg}：${done}/${total}`
            : msg
        if (text) {
          window.clearTimeout(bootingTimerId)
          setBackendProgressText(text)
        }

        if (stage && stage !== 'start' && stage !== 'ensure_latest' && stage !== 'cache_miss') {
          if (!treatAsRefetch) {
            setTreatAsRefetch(true)
          }
          if (!refetchStartedAt) {
            const startedAt = Date.now()
            setRefetchStartedAt(startedAt)
            setRefetchProgressPct(0)
          }
        }
      } catch {
        return
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 1000)
    return () => {
      cancelled = true
      window.clearTimeout(bootingTimerId)
      window.clearInterval(id)
    }
  }, [loading, loadingMode, progressToken, refetchStartedAt, treatAsRefetch])

  useEffect(() => {
    if (!refetchStartedAt || !loading) return
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - refetchStartedAt
      const pct = Math.min(99, Math.floor((elapsed / refetchEtaMs) * 100))
      setRefetchProgressPct(pct)
    }, 250)
    return () => window.clearInterval(timer)
  }, [loading, refetchEtaMs, refetchStartedAt])

  useEffect(() => {
    if (!refetchStartedAt) return
    if (loading) return
    setRefetchProgressPct(100)
    const t = window.setTimeout(() => {
      setRefetchStartedAt(null)
      setRefetchProgressPct(null)
    }, 800)
    return () => window.clearTimeout(t)
  }, [loading, refetchStartedAt])

  useEffect(() => {
    const seq = ++reqSeqRef.current

    const activeRefetchToken = window.localStorage.getItem(activeRefetchTokenKey)
    if (activeRefetchToken && /^\d+$/.test(activeRefetchToken)) {
      const startedAt = Number(activeRefetchToken)
      const maxAgeMs = 20 * 60_000
      if (Number.isFinite(startedAt) && Date.now() - startedAt < maxAgeMs) {
        void runFetch(seq, { mode: 'refetch', refreshToken: activeRefetchToken })
        return
      }
      window.localStorage.removeItem(activeRefetchTokenKey)
    }

    if (initialLoadDoneRef.current) {
      void runFetch(seq)
      return
    }
    initialLoadDoneRef.current = true

    const runInitial = async () => {
      let bootId = bootIdRef.current
      if (!bootId) {
        try {
          const res = await fetch(apiUrl('/api/health'))
          const j = (await res.json()) as unknown
          if (typeof j === 'object' && j !== null) {
            const v = (j as Record<string, unknown>).serverBootId
            if (typeof v === 'string' && v) bootId = v
          }
        } catch {
          bootId = null
        }
      }

      if (!bootId) {
        void runFetch(seq, { mode: 'fetch' })
        return
      }

      const lastBootId = window.localStorage.getItem('etf_monitor_server_boot_id')
      if (lastBootId === bootId) {
        void runFetch(seq, { mode: 'fetch' })
        return
      }

      const lockKey = `etf_monitor_refetch_lock:${bootId}`
      const lockTs = Number(window.localStorage.getItem(lockKey) || '0')
      const now = Date.now()
      const lockTtlMs = 240_000
      const shouldRefetch = !lockTs || now - lockTs > lockTtlMs
      window.localStorage.setItem('etf_monitor_server_boot_id', bootId)

      if (!shouldRefetch) {
        void runFetch(seq, { mode: 'fetch' })
        return
      }

      window.localStorage.setItem(lockKey, String(now))
      void runFetch(seq, { mode: 'cold' })
    }

    void runInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const incompleteCount = useMemo(
    () => rows.filter((r) => r.dataStatus !== 'complete').length,
    [rows],
  )

  const onToggleSort = (key: Top100SortKey) => {
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDir('desc')
        return key
      }
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return prev
    })
  }

  const onReset = () => {
    setKeyword('')
    setSortKey(defaultSort.key)
    setSortDir(defaultSort.dir)
  }

  const onRefetch = () => {
    if (isVercelBackend) {
      if (adminRefreshing) return
      const startedAt = Date.now()

      setAdminRefreshing(true)
      setAdminNotice({ tone: 'info', message: '已触发后台刷新任务（GitHub Actions），等待写入 Supabase 快照…' })
      setError(null)

      const prevFetchedAt = metaRef.current?.fetchedAt || null

      const hardTimeoutMs = 20 * 60_000
      const pollIntervalMs = 8_000

      void (async () => {
        try {
          const res = await fetch(apiUrl('/api/admin/refresh'), {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...adminAuthHeaders(),
            },
            body: JSON.stringify({ at: startedAt }),
          })
          const j = (await res.json().catch(() => null)) as unknown
          if (!res.ok) {
            const msg =
              j && typeof j === 'object' && (j as Record<string, unknown>).message
                ? String((j as Record<string, unknown>).message)
                : `触发刷新失败（HTTP ${res.status}）`
            throw new Error(msg)
          }

          const started = Date.now()
          let attempts = 0
          while (mountedRef.current) {
            const elapsed = Date.now() - started
            if (elapsed > hardTimeoutMs) {
              setAdminNotice({
                tone: 'warn',
                message: '刷新已触发，但快照写入可能仍在排队；你可以稍后再点一次“重新获取”，或等待页面下次拉取。',
              })
              break
            }

            attempts += 1
            setAdminNotice({ tone: 'info', message: `刷新任务运行中…（已等待 ${Math.ceil(elapsed / 1000)}s）` })

            const ac = new AbortController()
            const timeoutId = window.setTimeout(() => ac.abort(), 60_000)
            try {
              const out = await fetchEtfTop100(
                {
                  limit: 200,
                },
                ac.signal,
              )
              if (out.success === true) {
                setMeta(out.meta)
                setRows(out.data)
                const nextFetchedAt = out.meta?.fetchedAt || null
                const updated =
                  (prevFetchedAt && nextFetchedAt && nextFetchedAt !== prevFetchedAt) ||
                  (!prevFetchedAt && nextFetchedAt)
                if (updated) {
                  setAdminNotice(null)
                  break
                }
              }
            } catch {
              void 0
            } finally {
              window.clearTimeout(timeoutId)
            }

            await new Promise((r) => window.setTimeout(r, pollIntervalMs))
            if (attempts > 9999) break
          }
        } catch (e) {
          if (!mountedRef.current) return
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          if (mountedRef.current) setAdminRefreshing(false)
        }
      })()

      return
    }

    const seq = ++reqSeqRef.current
    const startedAt = Date.now()
    window.localStorage.setItem(activeRefetchTokenKey, String(startedAt))
    void runFetch(seq, { refreshToken: String(startedAt), mode: 'refetch' })
  }

  return (
    <div className="min-h-screen bg-[#050A0B] text-[#E6EDF7]">
      <NavBar
        rightMeta={
          meta
            ? {
                fetchedAt: meta.cachedAt || meta.fetchedAt,
                dataDate: meta.dataDate,
              }
            : undefined
        }
        onRefetch={onRefetch}
        refetching={adminRefreshing || (loading && (loadingMode === 'refetch' || treatAsRefetch))}
        onLogout={() => {
          void (async () => {
            try {
              ;(window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } })
                .google?.accounts?.id?.disableAutoSelect?.()
              await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                credentials: 'include',
              })
            } catch {
              void 0
            } finally {
              nav(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true })
            }
          })()
        }}
      />

      <main className="mx-auto w-full max-w-[1280px] px-8 pb-14 pt-8">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Top200 ETF 异动监测</h1>
          <div className="mt-2 text-sm text-[#9CA3AF]">
            仅展示最近一个完整交易日数据；缺失/失败会明确提示且不展示推测值。
          </div>
        </div>

        <DataStatusBanner
          loading={loading}
          error={error}
          notice={adminNotice}
          meta={meta}
          incompleteCount={incompleteCount}
          loadingMode={
            loading
              ? treatAsRefetch
                ? 'refetch'
                : loadingMode
              : 'fetch'
          }
          loadingProgressPct={treatAsRefetch || loadingMode === 'cold' ? refetchProgressPct : null}
          loadingEtaSeconds={treatAsRefetch || loadingMode === 'cold' ? refetchEtaSeconds : undefined}
          backendProgressText={backendProgressText}
          onRetry={() => {
            const seq = ++reqSeqRef.current
            void runFetch(seq)
          }}
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div role="tablist" aria-label="首页视图切换" className="flex items-center gap-8">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'list'}
              onClick={() => {
                if (tab === 'list') return
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'list')
                setSearchParams(next, { replace: true })
              }}
              className={cn(
                'relative inline-flex items-center gap-2 pb-2 text-sm font-semibold transition',
                tab === 'list' ? 'text-[#FF5722]' : 'text-[#9CA3AF] hover:text-white',
              )}
            >
              <img
                src={tab === 'list' ? '/figma/list/list_tab_icon.svg' : '/figma/list/list_tab_icon_muted.svg'}
                alt=""
                className="h-4 w-auto select-none"
                aria-hidden="true"
              />
              TOP200 列表
              {tab === 'list' ? (
                <span className="absolute -bottom-[10px] left-0 right-0 h-[2px] bg-[#FF5722]" />
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'insight'}
              onClick={() => {
                if (tab === 'insight') return
                const next = new URLSearchParams(searchParams)
                next.set('tab', 'insight')
                setSearchParams(next, { replace: true })
              }}
              className={cn(
                'relative inline-flex items-center gap-2 pb-2 text-sm font-semibold transition',
                tab === 'insight' ? 'text-[#FF5722]' : 'text-[#9CA3AF] hover:text-white',
              )}
            >
              <img
                src={tab === 'insight' ? '/figma/list/insight_tab_icon_active.svg' : '/figma/list/insight_tab_icon.svg'}
                alt=""
                className="h-4 w-auto select-none"
                aria-hidden="true"
              />
              AI 解读
              {tab === 'insight' ? (
                <span className="absolute -bottom-[10px] left-0 right-0 h-[2px] bg-[#FF5722]" />
              ) : null}
            </button>
          </div>

          <div className="sm:min-h-10 sm:flex sm:items-center">
            {tab === 'list' ? (
              <Top100FilterBar keyword={keyword} onChangeKeyword={setKeyword} onReset={onReset} />
            ) : (
              <div className="hidden h-10 sm:block" aria-hidden="true" />
            )}
          </div>
        </div>

        {tab === 'insight' ? (
          <Top100InsightPanel
            meta={meta}
            rows={rows}
          />
        ) : (
          <Top100Table
            rows={rows}
            loading={loading}
            error={error}
            keyword={debouncedKeyword}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={onToggleSort}
          />
        )}
      </main>
    </div>
  )
}
