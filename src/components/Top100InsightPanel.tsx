import { Loader2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/utils/apiBase'
import { adminAuthHeaders } from '@/utils/adminAccess'
import type { EtfTopRow, Top100Meta } from '@/utils/etfApi'

type InsightSegment =
  | { kind: 'text'; content: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }

function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  const noEdge = trimmed.replace(/^\|\s*/, '').replace(/\s*\|$/, '')
  return noEdge
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

function isSeparatorLine(line: string): boolean {
  const t = line.trim()
  if (!t.includes('-') || !t.includes('|')) return false
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(t)
}

function parseMarkdownTables(source: string): InsightSegment[] {
  const text = String(source || '')
  if (!text.trim()) return []

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: InsightSegment[] = []
  let buffer: string[] = []

  const flushText = () => {
    const content = buffer.join('\n').trimEnd()
    buffer = []
    if (content.trim()) out.push({ kind: 'text', content })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const next = i + 1 < lines.length ? lines[i + 1] : ''
    const looksLikeHeader = line.includes('|')
    if (looksLikeHeader && isSeparatorLine(next)) {
      const headers = parseTableRow(line)
      if (headers.length >= 2) {
        flushText()
        i += 2
        const rows: string[][] = []
        while (i < lines.length) {
          const rowLine = lines[i]
          if (!rowLine.trim()) break
          if (!rowLine.includes('|')) break
          if (isSeparatorLine(rowLine)) {
            i += 1
            continue
          }
          const row = parseTableRow(rowLine)
          if (row.length > 0) rows.push(row)
          i += 1
        }
        out.push({ kind: 'table', headers, rows })
        continue
      }
    }

    buffer.push(line)
    i += 1
  }

  flushText()
  return out
}

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
          const t = line.trim()
          if (!t) continue
          try {
            const j = JSON.parse(t) as unknown
            if (!j || typeof j !== 'object') continue
            const o = j as Record<string, unknown>
            if (o.type === 'content' && typeof o.content === 'string') {
              setText((prev) => prev + o.content)
              continue
            }
            if (o.type === 'end') {
              setDone(true)
              continue
            }
          } catch {
            setText((prev) => prev + line + '\n')
          }
        }
      }

      const tail = buffer.trim()
      if (tail) {
        try {
          const j = JSON.parse(tail) as unknown
          if (j && typeof j === 'object') {
            const o = j as Record<string, unknown>
            if (o.type === 'content' && typeof o.content === 'string') {
              setText((prev) => prev + o.content)
            }
            if (o.type === 'end') setDone(true)
          }
        } catch {
          setText((prev) => prev + tail)
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
  const segments = useMemo(() => (done ? parseMarkdownTables(text) : []), [done, text])

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
      ) : segments.length > 0 ? (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#E6EDF7]">
          {segments.map((seg, idx) => {
            if (seg.kind === 'text') {
              return (
                <div key={idx} className="whitespace-pre-wrap">
                  {seg.content}
                </div>
              )
            }

            return (
              <div key={idx} className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-white/10 bg-white/5 text-[#A9B6CC]">
                    <tr>
                      {seg.headers.map((h, hi) => (
                        <th key={hi} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {seg.rows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-[#A9B6CC]" colSpan={seg.headers.length}>
                          表格内容加载中…
                        </td>
                      </tr>
                    ) : (
                      seg.rows.map((r, ri) => (
                        <tr key={ri} className="hover:bg-white/5">
                          {Array.from({ length: seg.headers.length }).map((_, ci) => (
                            <td key={ci} className="px-3 py-2 align-top">
                              {r[ci] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#E6EDF7]">
          {loading
            ? `正在生成解读…已接收 ${text.length} 字`
            : done
              ? '暂无解读内容'
              : '等待生成完成…'}
        </div>
      )}
    </section>
  )
}
