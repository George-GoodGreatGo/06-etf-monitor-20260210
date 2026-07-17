import { Loader2, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiUrl } from '@/utils/apiBase'
import type { EtfTopRow, Top100Meta } from '@/utils/etfApi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type InsightGenerateStatus = 'idle' | 'generating' | 'ready' | 'failed'
type InsightSectionTone = 'summary' | 'focus' | 'risk' | 'snapshot' | 'normal'
type InsightSection = {
  title: string
  markdown: string
  tone: InsightSectionTone
}

function parseSectionTitle(line: string): string {
  const headingMatch = line.match(/^#{1,6}\s*(.+?)\s*$/)
  if (headingMatch?.[1]) return headingMatch[1].trim()

  const boldLineMatch = line.match(/^\*\*(.+?)\*\*[:：]?\s*$/)
  if (boldLineMatch?.[1]) return boldLineMatch[1].trim()

  return ''
}

function detectSectionTone(title: string): InsightSectionTone {
  const t = title.trim()
  if (/总览|结论|概览/.test(t)) return 'summary'
  if (/重点|异动|观察|机会/.test(t)) return 'focus'
  if (/风险|提示|注意/.test(t)) return 'risk'
  if (/快照|时间|口径|说明/.test(t)) return 'snapshot'
  return 'normal'
}

function buildInsightSections(markdown: string): InsightSection[] {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.trim()) return []

  const lines = normalized.split('\n')
  const anchors: Array<{ index: number; title: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const title = parseSectionTitle(lines[i])
    if (title) anchors.push({ index: i, title })
  }

  if (anchors.length < 1) return []

  const sections: InsightSection[] = []
  const firstAnchorIndex = anchors[0].index
  if (firstAnchorIndex > 0) {
    const preface = lines.slice(0, firstAnchorIndex).join('\n')
    if (preface.trim()) {
      sections.push({
        title: '解读正文',
        markdown: preface,
        tone: 'normal',
      })
    }
  }

  for (let i = 0; i < anchors.length; i += 1) {
    const current = anchors[i]
    const end = i + 1 < anchors.length ? anchors[i + 1].index : lines.length
    const block = lines.slice(current.index, end).join('\n')
    sections.push({
      title: current.title,
      markdown: block,
      tone: detectSectionTone(current.title),
    })
  }

  if (sections.length < 2) return []

  const reconstructed = sections
    .map((s) => s.markdown)
    .join('\n')
    .replace(/\r\n/g, '\n')
  if (reconstructed.trim() !== normalized.trim()) return []

  return sections
}

function toneClassName(tone: InsightSectionTone): string {
  if (tone === 'summary') return 'border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.08)]'
  if (tone === 'focus') return 'border-[rgba(255,138,80,0.4)] bg-[rgba(255,138,80,0.08)]'
  if (tone === 'risk') return 'border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)]'
  if (tone === 'snapshot') return 'border-[rgba(148,163,184,0.35)] bg-[rgba(148,163,184,0.08)]'
  return 'border-[#1E293B] bg-[#0B1120]'
}

export default function Top100InsightPanel({
  meta,
  rows,
  isHomeLoading,
}: {
  meta: Top100Meta | null
  rows: EtfTopRow[]
  isHomeLoading?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState<string>('')
  const [status, setStatus] = useState<InsightGenerateStatus>('idle')
  const [statusError, setStatusError] = useState<string | null>(null)
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

  // 1. Initial fetch & state transition logic
  useEffect(() => {
    if (isHomeLoading || !meta || rows.length === 0) {
      if (!isHomeLoading) {
        setMarkdown('')
        setStatus('idle')
        setStatusError(null)
        setLoading(false)
        setError(null)
      }
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)
    setStatusError(null)

    void (async () => {
      try {
        const statusRes = await fetch(apiUrl(`/api/ai/top100/insight/status?dataDate=${encodeURIComponent(meta.dataDate)}`), {
          method: 'GET',
          credentials: 'include',
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
          dataObj && typeof dataObj.status === 'string' && ['idle', 'generating', 'ready', 'failed'].includes(dataObj.status)
            ? (dataObj.status as InsightGenerateStatus)
            : 'idle'
        const nextStatusError = dataObj && typeof dataObj.lastError === 'string' ? dataObj.lastError : null

        setStatus(nextStatus)
        setStatusError(nextStatusError)
        if (nextStatus !== 'ready') {
          setMarkdown('')
          return
        }

        const insightRes = await fetch(apiUrl(`/api/ai/top100/insight?dataDate=${encodeURIComponent(meta.dataDate)}`), {
          method: 'GET',
          credentials: 'include',
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
  }, [key, meta, rows.length, isHomeLoading])

  // 2. Polling logic for 'generating' state
  useEffect(() => {
    if (status !== 'generating' || isHomeLoading || !meta) return

    let timer: number | null = null
    const tick = async () => {
      try {
        const res = await fetch(apiUrl(`/api/ai/top100/insight/status?dataDate=${encodeURIComponent(meta.dataDate)}`), {
          method: 'GET',
          credentials: 'include',
        })
        if (!res.ok) return
        const j = (await res.json()) as unknown
        if (!j || typeof j !== 'object') return
        const dataObj = (j as Record<string, unknown>).data as Record<string, unknown>
        if (!dataObj) return

        const nextStatus = dataObj.status as InsightGenerateStatus
        if (nextStatus === 'ready') {
          setStatus('ready')
          setStatusError(null)
          setReloadSeq((v) => v + 1)
          if (timer) window.clearInterval(timer)
        } else if (nextStatus === 'failed') {
          setStatus('failed')
          setStatusError(String(dataObj.lastError || '未知错误'))
        }
      } catch {
        void 0
      }
    }

    timer = window.setInterval(tick, 3000)
    return () => {
      if (timer) window.clearInterval(timer)
    }
  }, [status, isHomeLoading, meta])

  const hasContent = Boolean(markdown.trim())
  const sections = useMemo(() => {
    try {
      return buildInsightSections(markdown)
    } catch {
      return []
    }
  }, [markdown])

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }: { children?: ReactNode }) => (
        <h1 className="mb-2 mt-2 text-base font-semibold text-[#F8FAFC]">{children}</h1>
      ),
      h2: ({ children }: { children?: ReactNode }) => (
        <h2 className="mb-2 mt-2 text-sm font-semibold text-[#F1F5F9]">{children}</h2>
      ),
      h3: ({ children }: { children?: ReactNode }) => (
        <h3 className="mb-1 mt-2 text-sm font-semibold text-[#E2E8F0]">{children}</h3>
      ),
      p: ({ children }: { children?: ReactNode }) => (
        <p className="mb-2 leading-7 text-[#E6EDF7]">{children}</p>
      ),
      ul: ({ children }: { children?: ReactNode }) => (
        <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>
      ),
      ol: ({ children }: { children?: ReactNode }) => (
        <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li className="leading-7 text-[#E6EDF7]">{children}</li>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong className="font-semibold text-[#FFF2E8]">{children}</strong>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote className="my-2 border-l-2 border-white/20 pl-3 text-[#CBD5E1]">{children}</blockquote>
      ),
      table: ({ children }: { children?: ReactNode }) => <table className="my-2 w-full border-collapse text-xs">{children}</table>,
      th: ({ children }: { children?: ReactNode }) => (
        <th className="border border-white/10 px-2 py-1 text-left font-semibold text-[#E2E8F0]">{children}</th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className="border border-white/10 px-2 py-1 text-[#E6EDF7]">{children}</td>
      ),
      code: ({ children }: { children?: ReactNode }) => (
        <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] text-[#FDE68A]">{children}</code>
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-[#FFB08A] underline decoration-dotted underline-offset-2">
          {children}
        </a>
      ),
    }),
    [],
  )

  return (
    <section
      className="mt-4 overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] px-4 py-3 shadow-lg"
      data-testid="top100-insight"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#FF8A50]" />
          <div className="text-sm font-medium text-[#E2E8F0]">大模型解读（基于快照）</div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#EF4444]/40 bg-[#0B1120] px-3 py-2 text-xs text-[#94A3B8]">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[#EF4444]" />
          <div>
            <div className="text-[#E2E8F0]">解读读取失败</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      ) : null}

      {isHomeLoading ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0B1120] px-3 py-2 text-xs text-[#94A3B8]">
          <Loader2 className="h-4 w-4 animate-spin text-[#FF5722]" />
          正在获取新交易日的数据…
        </div>
      ) : loading ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0B1120] px-3 py-2 text-xs text-[#94A3B8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取解读状态…
        </div>
      ) : status === 'ready' && hasContent ? (
        sections.length > 0 ? (
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#E2E8F0]">
            {sections.map((section, idx) => (
              <div key={`${section.title}-${idx}`} className={`rounded-lg border px-3 py-3 ${toneClassName(section.tone)}`}>
                {parseSectionTitle(section.markdown.split('\n')[0] || '') === section.title ? null : (
                  <div className="mb-2 text-sm font-semibold tracking-wide text-[#FFF2E8]">{section.title}</div>
                )}
                {section.markdown ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {section.markdown}
                  </ReactMarkdown>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm leading-relaxed text-[#E2E8F0]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {markdown}
            </ReactMarkdown>
          </div>
        )
      ) : status === 'generating' ? (
        <div className="mt-3 rounded-lg border border-[#1E293B] bg-[#0B1120] px-3 py-3 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF8A50]" />
            <div>正调用大模型进行生成，请稍等</div>
          </div>
        </div>
      ) : status === 'failed' ? (
        <div className="mt-3 rounded-lg border border-[#EF4444]/40 bg-[#0B1120] px-3 py-3 text-xs text-[#94A3B8]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[#FCA5A5]">解读生成失败，请稍后重试</div>
              {statusError ? <div className="text-[#94A3B8]">{statusError}</div> : null}
            </div>
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
        <div className="mt-3 rounded-lg border border-[#1E293B] bg-[#0B1120] px-3 py-2 text-xs text-[#94A3B8]">
          未有解读内容，请点击右上角“重新获取”按钮
        </div>
      )}
    </section>
  )
}
