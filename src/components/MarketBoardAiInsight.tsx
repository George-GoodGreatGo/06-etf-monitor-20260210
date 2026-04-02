import { useMemo, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'

type Status = 'idle' | 'running' | 'done' | 'error'

export default function MarketBoardAiInsight({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [finishReason, setFinishReason] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [debugModel, setDebugModel] = useState<string | null>(null)
  const [debugSearchMode, setDebugSearchMode] = useState<string | null>(null)
  const [debugRequest, setDebugRequest] = useState<string | null>(null)
  const [debugSearch, setDebugSearch] = useState<string | null>(null)
  const [debugDeveloperPrompt, setDebugDeveloperPrompt] = useState<string | null>(null)
  const [debugUserPrompt, setDebugUserPrompt] = useState<string | null>(null)
  const [reasoningText, setReasoningText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const mdComponents = useMemo<Components>(
    () => ({
      h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold text-white">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold text-white">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-semibold text-[#E6EDF7]">{children}</h3>,
      p: ({ children }) => <p className="my-2 leading-relaxed text-[#E6EDF7]">{children}</p>,
      ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-[#E6EDF7]">{children}</ul>,
      ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-[#E6EDF7]">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-white/20 pl-3 text-[#CBD5E1]">{children}</blockquote>,
      table: ({ children }) => <table className="my-2 w-full border-collapse text-xs">{children}</table>,
      th: ({ children }) => <th className="border border-white/10 px-2 py-1 text-left font-semibold text-[#E2E8F0]">{children}</th>,
      td: ({ children }) => <td className="border border-white/10 px-2 py-1 text-[#E6EDF7]">{children}</td>,
      code: ({ children }) => <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] text-[#FDE68A]">{children}</code>,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-[#FFB08A] underline decoration-dotted underline-offset-2">
          {children}
        </a>
      ),
    }),
    [],
  )

  const start = useMemo(() => {
    return async (opts?: { continueFrom?: string }) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      setStatus('running')
      setError(null)
      setFinishReason(null)
      setTruncated(false)
      setDebugModel(null)
      setDebugSearchMode(null)
      setDebugRequest(null)
      setDebugSearch(null)
      setDebugDeveloperPrompt(null)
      setDebugUserPrompt(null)
      setReasoningText('')
      if (!opts?.continueFrom) setText('')

      try {
        const res = await fetch(apiUrl('/api/ai/market/insight'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...adminAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...(opts?.continueFrom ? { continueFrom: opts.continueFrom } : {}) }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as unknown
          const msg =
            j && typeof j === 'object' && (j as Record<string, unknown>).message
              ? String((j as Record<string, unknown>).message)
              : `HTTP ${res.status}`
          setStatus('error')
          setError(msg)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        let finished = false
        let hadError = false

        const handleEvent = (o: Record<string, unknown>) => {
          const type = typeof o.type === 'string' ? o.type : ''
          if (type === 'meta') {
            if (typeof o.model === 'string') setDebugModel(o.model)
            if (typeof o.searchMode === 'string') setDebugSearchMode(o.searchMode)
            return { done: false }
          }
          if (type === 'debug') {
            try {
              const req = o.request && typeof o.request === 'object' ? o.request : null
              const search = o.search && typeof o.search === 'object' ? o.search : null
              const prompts = o.prompts && typeof o.prompts === 'object' ? (o.prompts as Record<string, unknown>) : null
              setDebugRequest(req ? JSON.stringify(req, null, 2) : null)
              setDebugSearch(search ? JSON.stringify(search, null, 2) : null)
              setDebugDeveloperPrompt(prompts && typeof prompts.developer === 'string' ? prompts.developer : null)
              setDebugUserPrompt(prompts && typeof prompts.user === 'string' ? prompts.user : null)
            } catch {
              void 0
            }
            return { done: false }
          }
          if (type === 'content' && typeof o.content === 'string') {
            setText((prev) => prev + o.content)
            return { done: false }
          }
          if (type === 'answer') {
            const c = o.content as unknown
            const answer =
              c && typeof c === 'object' && typeof (c as Record<string, unknown>).answer === 'string'
                ? String((c as Record<string, unknown>).answer)
                : ''
            if (answer) setText((prev) => prev + answer)
            return { done: false }
          }
          if (type === 'reasoning' && typeof o.content === 'string') {
            setReasoningText((prev) => prev + o.content)
            return { done: false }
          }
          if (type === 'end') {
            const s = typeof o.status === 'string' ? o.status : ''
            const fr = typeof o.finishReason === 'string' ? o.finishReason : null
            setFinishReason(fr)
            setTruncated(fr === 'length')
            if (s === 'error') {
              const msg = typeof o.message === 'string' ? o.message : '解读失败'
              setStatus('error')
              setError(msg)
              hadError = true
            }
            return { done: true }
          }
          return { done: false }
        }

        while (!finished) {
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
              const r = handleEvent(j as Record<string, unknown>)
              if (r.done) {
                finished = true
                break
              }
            } catch {
              void 0
            }
          }
        }

        if (!hadError) setStatus('done')
      } catch (e) {
        const name = typeof e === 'object' && e && 'name' in e ? String((e as { name: unknown }).name) : ''
        if (name === 'AbortError') return
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      }
    }
  }, [])

  return (
    <div className={cn('mt-4 rounded-lg border border-white/10 bg-[#111B2E]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="text-sm font-semibold text-white">AI 解读</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B6CC]">
          {text ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                } catch {
                  void 0
                }
              }}
              disabled={status === 'running'}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-[6px] border px-3 text-xs font-semibold transition',
                status === 'running'
                  ? 'cursor-not-allowed border-white/10 bg-white/5 text-[#94A3B8]'
                  : 'border-white/10 bg-white/5 text-[#E6EDF7] hover:border-white/15 hover:bg-white/10',
              )}
            >
              {copied ? '已复制' : '复制'}
            </button>
          ) : null}
          {truncated && status !== 'running' ? (
            <button
              type="button"
              onClick={() => start({ continueFrom: text })}
              className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[#FF5722] px-3 text-xs font-semibold text-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.35),0px_10px_15px_-3px_rgba(0,0,0,0.35)] transition hover:brightness-110 active:brightness-95"
            >
              继续生成
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => start()}
            disabled={status === 'running'}
            className={cn(
              'inline-flex h-8 items-center justify-center rounded-[6px] px-3 text-xs font-semibold shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.35),0px_10px_15px_-3px_rgba(0,0,0,0.35)] transition',
              status === 'running' ? 'cursor-not-allowed bg-[#FF5722]/60 text-white/90' : 'bg-[#FF5722] text-white hover:brightness-110 active:brightness-95',
            )}
          >
            {status === 'running' ? '生成中…' : '生成 AI 解读'}
          </button>
        </div>
      </div>

      <div className="px-3 py-3">
        {status === 'idle' ? (
          <div className="text-xs leading-relaxed text-[#94A3B8]">
            点击生成后，将基于大盘看板的多周期指标摘要与过去 720 天的指标数据生成解读，并分别从短线/中线/长线视角归纳观点。搜索策略由智能体侧自主决策执行。
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-md border border-[rgba(239,68,68,0.35)] bg-black/20 px-3 py-2 text-xs text-[#E6EDF7]">
            <div className="font-semibold text-white">生成失败</div>
            <div className="mt-1 text-[#FCA5A5]">{error ?? '未知错误'}</div>
          </div>
        ) : null}

        {status === 'running' ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-[#A9B6CC]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            正在生成解读…
          </div>
        ) : null}

        {status !== 'idle' ? (
          <details className="mb-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
            <summary className="cursor-pointer select-none text-xs text-[#A9B6CC]">调试信息</summary>
            <div className="mt-2 space-y-3 text-[11px] text-[#94A3B8]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div>model: {debugModel ?? '—'}</div>
                <div>searchMode: {debugSearchMode ?? '—'}</div>
                {finishReason ? <div>finish_reason: {finishReason}</div> : null}
              </div>

              <div>
                <div className="mb-1 font-semibold text-[#CBD5E1]">参数（请求）</div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2 text-[#E2E8F0]">
                  {debugRequest ?? '—'}
                </pre>
              </div>

              <div>
                <div className="mb-1 font-semibold text-[#CBD5E1]">搜索（queries）</div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2 text-[#E2E8F0]">
                  {debugSearch ?? '—'}
                </pre>
              </div>

              <div>
                <div className="mb-1 font-semibold text-[#CBD5E1]">Developer Prompt</div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2 text-[#E2E8F0]">
                  {debugDeveloperPrompt ?? '—'}
                </pre>
              </div>

              <div>
                <div className="mb-1 font-semibold text-[#CBD5E1]">User Prompt</div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2 text-[#E2E8F0]">
                  {debugUserPrompt ?? '—'}
                </pre>
              </div>
            </div>
          </details>
        ) : null}

        {status === 'done' && truncated ? (
          <div className="mb-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#A9B6CC]">
            当前输出可能达到长度上限（finish_reason=length），可点击“继续生成”补全剩余内容。
          </div>
        ) : null}

        {reasoningText ? (
          <details className="mb-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
            <summary className="cursor-pointer select-none text-xs text-[#A9B6CC]">模型推理内容（reasoning_content）</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2 text-xs text-[#E2E8F0]">
              {reasoningText}
            </pre>
          </details>
        ) : null}

        {text ? (
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {text}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  )
}
