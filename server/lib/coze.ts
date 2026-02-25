import { randomUUID } from 'node:crypto'

function mustEnv(name: string): string {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

function extractMarkdownFromCozeEvent(o: Record<string, unknown>): { text: string; done: boolean } {
  const type = typeof o.type === 'string' ? o.type : ''

  if (type === 'content' && typeof o.content === 'string') {
    return { text: o.content, done: false }
  }

  if (type === 'answer') {
    const c = o.content as unknown
    const answer =
      c && typeof c === 'object' && typeof (c as Record<string, unknown>).answer === 'string'
        ? String((c as Record<string, unknown>).answer)
        : ''
    const finish = Boolean(o.finish)
    return { text: answer, done: finish }
  }

  if (type === 'end' || type === 'message_end') {
    return { text: '', done: true }
  }

  const c = o.content as unknown
  if (c && typeof c === 'object') {
    const contentObj = c as Record<string, unknown>
    if (contentObj.message_end) return { text: '', done: true }
  }

  return { text: '', done: false }
}

export async function cozeStreamRunToMarkdown(promptText: string, opts?: { sessionId?: string; signal?: AbortSignal }) {
  const token = mustEnv('COZE_BEARER_TOKEN')
  const url = String(process.env.COZE_STREAM_RUN_URL || 'https://f87gr4kxcm.coze.site/stream_run').trim()

  const projectIdRaw = String(process.env.COZE_PROJECT_ID || '').trim()
  const sessionId = String(opts?.sessionId || '').trim() || String(process.env.COZE_SESSION_ID || '').trim() || randomUUID()

  const body: Record<string, unknown> = {
    content: {
      query: {
        prompt: [
          {
            type: 'text',
            content: {
              text: String(promptText || ''),
            },
          },
        ],
      },
    },
    type: 'query',
    session_id: sessionId,
  }

  if (projectIdRaw) {
    body.project_id = Number.isFinite(Number(projectIdRaw)) ? Number(projectIdRaw) : projectIdRaw
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, text/plain, application/json',
    },
    body: JSON.stringify(body),
    signal: opts?.signal,
  })

  if (!upstream.ok) {
    const msg = await upstream.text().catch(() => '')
    throw new Error(`Coze 调用失败：HTTP ${upstream.status} ${msg}`)
  }

  if (!upstream.body) {
    const text = await upstream.text().catch(() => '')
    return {
      sessionId,
      markdown: text,
    }
  }

  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
  const isEventStream = contentType.includes('text/event-stream')
  if (!isEventStream) {
    const text = await upstream.text().catch(() => '')
    return {
      sessionId,
      markdown: text,
    }
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let out = ''
  let done = false

  try {
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (streamDone) break
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
          const { text, done: d } = extractMarkdownFromCozeEvent(j as Record<string, unknown>)
          if (text) out += text
          if (d) {
            done = true
            break
          }
        } catch {
          void 0
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      void 0
    }
  }

  const tail = buffer.trim()
  if (!done && tail) {
    const trimmed = tail.trimStart()
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          const j = JSON.parse(data) as unknown
          if (j && typeof j === 'object') {
            const { text } = extractMarkdownFromCozeEvent(j as Record<string, unknown>)
            if (text) out += text
          }
        } catch {
          void 0
        }
      }
    }
  }

  return {
    sessionId,
    markdown: out,
  }
}

