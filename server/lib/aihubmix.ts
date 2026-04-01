type ChatMessage = { role: 'system' | 'developer' | 'user' | 'assistant'; content: string }

function pickTextFromChatCompletionChunk(o: Record<string, unknown>): { text: string; done: boolean; finishReason: string | null } {
  const choices = o.choices
  if (!Array.isArray(choices) || !choices.length) return { text: '', done: false, finishReason: null }
  const c0 = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : null
  if (!c0) return { text: '', done: false, finishReason: null }
  const finishReason = typeof c0.finish_reason === 'string' && c0.finish_reason ? c0.finish_reason : null
  const finish = Boolean(finishReason)

  const delta = c0.delta && typeof c0.delta === 'object' ? (c0.delta as Record<string, unknown>) : null
  const content =
    delta && typeof delta.content === 'string'
      ? delta.content
      : c0.message && typeof c0.message === 'object' && typeof (c0.message as Record<string, unknown>).content === 'string'
        ? String((c0.message as Record<string, unknown>).content)
        : ''
  return { text: content, done: finish, finishReason }
}

export async function aihubmixChatCompletionsToSseEvents(opts: {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  seed?: number
  signal?: AbortSignal
  onEvent: (event: Record<string, unknown>) => void
}) {
  const baseUrl = String(opts.baseUrl || '').trim().replace(/\/+$/, '')
  const apiKey = String(opts.apiKey || '').trim()
  const model = String(opts.model || '').trim()
  if (!baseUrl) throw new Error('缺少服务端环境变量：AIHUBMIX_BASE_URL')
  if (!apiKey) throw new Error('缺少服务端环境变量：AIHUBMIX_API_KEY')
  if (!model) throw new Error('缺少服务端环境变量：AIHUBMIX_MODEL')

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json, text/plain',
    },
    body: JSON.stringify({
      model,
      messages: opts.messages.map((m) => ({ ...m, role: m.role === 'developer' ? 'system' : m.role })),
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.4,
      top_p: typeof opts.topP === 'number' ? opts.topP : 1,
      max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : 1600,
      ...(typeof opts.seed === 'number' ? { seed: opts.seed } : {}),
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!upstream.ok) {
    const msg = await upstream.text().catch(() => '')
    throw new Error(`AIHubMix 调用失败：HTTP ${upstream.status} ${msg}`)
  }

  if (!upstream.body) {
    const text = await upstream.text().catch(() => '')
    if (text) opts.onEvent({ type: 'answer', content: { answer: text }, finish: true })
    opts.onEvent({ type: 'end', status: 'success' })
    return
  }

  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
  const isEventStream = contentType.includes('text/event-stream')
  if (!isEventStream) {
    const text = await upstream.text().catch(() => '')
    if (text) opts.onEvent({ type: 'answer', content: { answer: text }, finish: true })
    opts.onEvent({ type: 'end', status: 'success' })
    return
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let done = false
  let lastFinishReason: string | null = null

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
        if (!data || data === '[DONE]') {
          if (data === '[DONE]') done = true
          continue
        }
        try {
          const j = JSON.parse(data) as unknown
          if (!j || typeof j !== 'object') continue
          const { text, done: d, finishReason } = pickTextFromChatCompletionChunk(j as Record<string, unknown>)
          if (finishReason) lastFinishReason = finishReason
          if (text) opts.onEvent({ type: 'answer', content: { answer: text }, finish: false })
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

  opts.onEvent({ type: 'end', status: 'success', finishReason: lastFinishReason })
}
