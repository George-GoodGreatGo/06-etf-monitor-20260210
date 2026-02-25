import { Loader2, Sparkles, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import type { EtfTopRow, Top100Meta } from '@/utils/etfApi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  const [expanded, setExpanded] = useState(false)

  const snapshotAt = meta ? meta.cachedAt || meta.fetchedAt : null
  const key = useMemo(() => {
    const d = meta?.dataDate || ''
    const s = snapshotAt || ''
    const n = rows.length
    return `${d}|${s}|${n}`
  }, [meta?.dataDate, rows.length, snapshotAt])

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!meta || rows.length === 0) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const res = await fetch(apiUrl(`/api/ai/top100/insight?dataDate=${encodeURIComponent(meta.dataDate)}`), {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...adminAuthHeaders(),
          },
          signal: ac.signal,
        })

        if (res.status === 404) {
          setMarkdown('')
          return
        }

        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as unknown
          const msg =
            j && typeof j === 'object' && (j as Record<string, unknown>).message
              ? String((j as Record<string, unknown>).message)
              : `HTTP ${res.status}`
          throw new Error(msg)
        }

        const j = (await res.json().catch(() => null)) as unknown
        const dataObj =
          j && typeof j === 'object' && (j as Record<string, unknown>).data && typeof (j as Record<string, unknown>).data === 'object'
            ? ((j as Record<string, unknown>).data as Record<string, unknown>)
            : null
        const md = dataObj && typeof dataObj.markdown === 'string' ? dataObj.markdown : ''
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ui-btn ui-btn-outline h-9 px-3 text-xs"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? '折叠' : '展开'}
          </button>
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

      {!expanded ? (
        <div className="mt-3 text-xs text-[#A9B6CC]">
          {hasContent ? '已生成解读，点击“展开”查看' : '解读尚未生成，点击“展开”查看状态'}
        </div>
      ) : loading ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取解读…
        </div>
      ) : hasContent ? (
        <div className="mt-3 text-sm leading-relaxed text-[#E6EDF7]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-[#A9B6CC]">
          解读尚未生成。系统会在检测到新交易日快照后自动生成并落库；同一交易日只会生成一次。
        </div>
      )}
    </section>
  )
}
