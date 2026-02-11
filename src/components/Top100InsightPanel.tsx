import { Loader2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import type { EtfTopRow, Top100Meta } from '@/utils/etfApi'

export default function Top100InsightPanel({
  meta,
  rows,
}: {
  meta: Top100Meta | null
  rows: EtfTopRow[]
}) {
  const [text, setText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const snapshotAt = meta ? meta.cachedAt || meta.fetchedAt : null
  const key = useMemo(() => {
    const d = meta?.dataDate || ''
    const s = snapshotAt || ''
    const n = rows.length
    return `${d}|${s}|${n}`
  }, [meta?.dataDate, rows.length, snapshotAt])

  const ranKeyRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = async () => {
    if (!meta || rows.length === 0) return
    if (loading) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)
    setText('')

    try {
      const res = await fetch(apiUrl('/api/ai/top100/insight'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminAuthHeaders(),
        },
        body: JSON.stringify({ snapshotAt, dataDate: meta.dataDate, count: rows.length }),
        signal: ac.signal,
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as unknown
        const msg =
          j && typeof j === 'object' && (j as Record<string, unknown>).message
            ? String((j as Record<string, unknown>).message)
            : `HTTP ${res.status}`
        throw new Error(msg)
      }

      if (!res.body) {
        throw new Error('响应不支持流式读取')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (chunk) {
          setText((prev) => prev + chunk)
        }
      }
    } catch (e) {
      const name =
        typeof e === 'object' && e && 'name' in e
          ? String((e as { name: unknown }).name)
          : ''
      if (name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!meta || rows.length === 0) return
    if (ranKeyRef.current === key) return
    ranKeyRef.current = key
    void run()
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!meta || rows.length === 0) return null

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-[#111B2E] px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#60A5FA]" />
          <div className="text-sm font-medium">大模型解读（基于快照）</div>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          重新生成
        </button>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[#EF4444]" />
          <div>
            <div className="text-[#E6EDF7]">解读生成失败</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#E6EDF7]">
        {text
          ? text
          : loading
            ? '正在生成解读…（流式输出）'
            : '暂无解读内容'}
      </div>
    </section>
  )
}

