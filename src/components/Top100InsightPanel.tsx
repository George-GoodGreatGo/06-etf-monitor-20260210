import { Loader2, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import type { EtfTopRow, Top100Meta } from '@/utils/etfApi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type InsightGenerateStatus = 'idle' | 'generating' | 'ready'

export default function Top100InsightPanel({
  meta,
  rows,
}: {
  meta: Top100Meta | null
  rows: EtfTopRow[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState<string>('')
  const [status, setStatus] = useState<InsightGenerateStatus>('idle')
  const [reloadSeq, setReloadSeq] = useState(0)

  const snapshotAt = meta ? meta.cachedAt || meta.fetchedAt : null
  const key = useMemo(() => {
    const d = meta?.dataDate || ''
    const s = snapshotAt || ''
    const n = rows.length
    return `${d}|${s}|${n}|${reloadSeq}`
  }, [meta?.dataDate, reloadSeq, rows.length, snapshotAt])

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!meta || rows.length === 0) {
      setMarkdown('')
      setStatus('idle')
      setLoading(false)
      setError(null)
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const statusRes = await fetch(apiUrl(`/api/ai/top100/insight/status?dataDate=${encodeURIComponent(meta.dataDate)}`), {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...adminAuthHeaders(),
          },
          signal: ac.signal,
        })

        if (!statusRes.ok) {
          const j = (await statusRes.json().catch(() => null)) as unknown
          const msg =
            j && typeof j === 'object' && (j as Record<string, unknown>).message
              ? String((j as Record<string, unknown>).message)
              : `HTTP ${statusRes.status}`
          throw new Error(msg)
        }

        const j = (await statusRes.json().catch(() => null)) as unknown
        const dataObj =
          j && typeof j === 'object' && (j as Record<string, unknown>).data && typeof (j as Record<string, unknown>).data === 'object'
            ? ((j as Record<string, unknown>).data as Record<string, unknown>)
            : null
        const nextStatus =
          dataObj && typeof dataObj.status === 'string' && ['idle', 'generating', 'ready'].includes(dataObj.status)
            ? (dataObj.status as InsightGenerateStatus)
            : 'idle'

        setStatus(nextStatus)
        if (nextStatus !== 'ready') {
          setMarkdown('')
          return
        }

        const insightRes = await fetch(apiUrl(`/api/ai/top100/insight?dataDate=${encodeURIComponent(meta.dataDate)}`), {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...adminAuthHeaders(),
          },
          signal: ac.signal,
        })

        if (insightRes.status === 404) {
          setMarkdown('')
          return
        }

        if (!insightRes.ok) {
          const insightErr = (await insightRes.json().catch(() => null)) as unknown
          const msg =
            insightErr && typeof insightErr === 'object' && (insightErr as Record<string, unknown>).message
              ? String((insightErr as Record<string, unknown>).message)
              : `HTTP ${insightRes.status}`
          throw new Error(msg)
        }

        const insightObj = (await insightRes.json().catch(() => null)) as unknown
        const insightData =
          insightObj &&
          typeof insightObj === 'object' &&
          (insightObj as Record<string, unknown>).data &&
          typeof (insightObj as Record<string, unknown>).data === 'object'
            ? ((insightObj as Record<string, unknown>).data as Record<string, unknown>)
            : null
        const md = insightData && typeof insightData.markdown === 'string' ? insightData.markdown : ''
        setMarkdown(md)
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
    })()
  }, [key, meta, rows.length])

  const hasContent = Boolean(markdown.trim())

  return (
    <section className="mt-4 ui-glass-panel px-4 py-3" data-testid="top100-insight">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#FF8A50]" />
          <div className="text-sm font-medium">大模型解读（基于快照）</div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[#EF4444]" />
          <div>
            <div className="text-[#E6EDF7]">解读读取失败</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取解读状态…
        </div>
      ) : status === 'ready' && hasContent ? (
        <div className="mt-3 text-sm leading-relaxed text-[#E6EDF7]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ) : status === 'generating' ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-3 text-xs text-[#A9B6CC]">
          <div className="flex items-center justify-between gap-3">
            <div>内容正在生成中，请稍等</div>
            <button
              type="button"
              onClick={() => setReloadSeq((v) => v + 1)}
              className="ui-btn ui-btn-outline h-8 px-3 text-xs"
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
          未有解读内容，请点击右上角“重新获取”按钮
        </div>
      )}
    </section>
  )
}
