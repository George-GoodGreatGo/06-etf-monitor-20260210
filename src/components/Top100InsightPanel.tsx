import { Loader2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
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
  const [text, setText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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
    setDone(false)

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
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue

        buffer += chunk
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trimStart()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const j = JSON.parse(data) as unknown
            if (!j || typeof j !== 'object') continue
            const o = j as Record<string, unknown>
            const type = typeof o.type === 'string' ? o.type : ''

            if (type === 'content' && typeof o.content === 'string') {
              setText((prev) => prev + o.content)
              continue
            }

            if (type === 'answer') {
              const c = o.content as unknown
              const answer =
                c && typeof c === 'object' && typeof (c as Record<string, unknown>).answer === 'string'
                  ? String((c as Record<string, unknown>).answer)
                  : ''
              if (answer) setText((prev) => prev + answer)

              const finish = Boolean(o.finish)
              if (finish) setDone(true)
              continue
            }

            if (type === 'end' || type === 'message_end') {
              setDone(true)
              continue
            }

            if (o.content && typeof o.content === 'object') {
              const contentObj = o.content as Record<string, unknown>
              if (contentObj.message_end) {
                setDone(true)
                continue
              }
            }
          } catch {
            void 0
          }
        }
      }

      const tail = buffer.trim()
      if (tail) {
        const trimmed = tail.trimStart()
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim()
          if (data && data !== '[DONE]') {
            try {
              const j = JSON.parse(data) as unknown
              if (j && typeof j === 'object') {
                const o = j as Record<string, unknown>
                const type = typeof o.type === 'string' ? o.type : ''
                if (type === 'content' && typeof o.content === 'string') {
                  setText((prev) => prev + o.content)
                } else if (type === 'answer') {
                  const c = o.content as unknown
                  const answer =
                    c && typeof c === 'object' && typeof (c as Record<string, unknown>).answer === 'string'
                      ? String((c as Record<string, unknown>).answer)
                      : ''
                  if (answer) setText((prev) => prev + answer)
                  if (Boolean(o.finish)) setDone(true)
                }

                if (type === 'end' || type === 'message_end') setDone(true)
                if (o.content && typeof o.content === 'object') {
                  const contentObj = o.content as Record<string, unknown>
                  if (contentObj.message_end) setDone(true)
                }
              }
            } catch {
              void 0
            }
          }
        }
      }

      setDone(true)
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

  const ready = Boolean(meta && rows.length > 0)
  const markdown = useMemo(() => (done ? text : ''), [done, text])

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-[#111B2E] px-4 py-3" data-testid="top100-insight">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#60A5FA]" />
          <div className="text-sm font-medium">大模型解读（基于快照）</div>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={!ready || loading}
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

      {!ready ? (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#E6EDF7]">
          等待 Top100 数据加载完成后自动生成解读
        </div>
      ) : markdown.trim() ? (
        <div className="mt-3 text-sm leading-relaxed text-[#E6EDF7]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h2 {...props} className="mb-2 mt-3 text-base font-semibold" />,
              h2: (props) => <h3 {...props} className="mb-2 mt-4 text-sm font-semibold text-[#E6EDF7]" />,
              h3: (props) => <h4 {...props} className="mb-2 mt-3 text-sm font-semibold text-[#E6EDF7]" />,
              p: (props) => <p {...props} className="my-2 leading-relaxed text-[#E6EDF7]" />,
              ul: (props) => <ul {...props} className="my-2 list-disc space-y-1 pl-5" />,
              ol: (props) => <ol {...props} className="my-2 list-decimal space-y-1 pl-5" />,
              li: (props) => <li {...props} className="leading-relaxed" />,
              strong: (props) => <strong {...props} className="font-semibold text-[#E6EDF7]" />,
              em: (props) => <em {...props} className="text-[#E6EDF7]" />,
              a: ({ href, children, ...rest }) => (
                <a
                  {...rest}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[#60A5FA] underline underline-offset-2 hover:text-[#93C5FD]"
                >
                  {children}
                </a>
              ),
              hr: (props) => <hr {...props} className="my-4 border-white/10" />,
              blockquote: (props) => (
                <blockquote {...props} className="my-3 border-l-2 border-white/10 pl-3 text-[#A9B6CC]" />
              ),
              code: (props) => {
                const { inline, className, children, ...rest } = props as any
                if (inline) {
                  return (
                    <code
                      {...rest}
                      className="rounded bg-white/5 px-1 py-0.5 font-mono text-[12px] text-[#E6EDF7]"
                    >
                      {children}
                    </code>
                  )
                }
                return (
                  <code {...rest} className={className}>
                    {children}
                  </code>
                )
              },
              pre: (props) => (
                <pre
                  {...props}
                  className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs"
                />
              ),
              table: (props) => (
                <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
                  <table {...props} className="w-full min-w-[680px] text-left text-xs" />
                </div>
              ),
              thead: (props) => <thead {...props} className="border-b border-white/10 bg-white/5 text-[#A9B6CC]" />,
              th: (props) => <th {...props} className="px-3 py-2 font-medium" />,
              td: (props) => <td {...props} className="px-3 py-2 align-top" />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#E6EDF7]">
          {text
            ? text
            : loading
              ? '正在生成解读…（流式输出）'
              : done
                ? '暂无解读内容'
                : '等待生成完成…'}
        </div>
      )}
    </section>
  )
}
