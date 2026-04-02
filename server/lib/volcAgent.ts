type AgentMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function pickTextFromChunk(o: Record<string, unknown>): { answer: string; reasoning: string; done: boolean } {
  const choices = o.choices
  if (!Array.isArray(choices) || !choices.length) return { answer: '', reasoning: '', done: false }
  const c0 = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : null
  if (!c0) return { answer: '', reasoning: '', done: false }
  const finish = typeof c0.finish_reason === 'string' && c0.finish_reason ? true : false
  const delta = c0.delta && typeof c0.delta === 'object' ? (c0.delta as Record<string, unknown>) : null
  const message = c0.message && typeof c0.message === 'object' ? (c0.message as Record<string, unknown>) : null

  const answer =
    (delta && typeof delta.content === 'string' ? delta.content : '') ||
    (message && typeof message.content === 'string' ? message.content : '')
  const reasoning =
    (delta && typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '') ||
    (message && typeof message.reasoning_content === 'string' ? message.reasoning_content : '')
  return { answer, reasoning, done: finish }
}

export async function volcAgentChatToSseEvents(opts: {
  apiKey: string
  botId: string
  endpoint?: string
  messages: AgentMessage[]
  model?: 'thinking' | 'auto_thinking'
  userId?: string
  stream?: boolean
  signal?: AbortSignal
  onEvent: (event: Record<string, unknown>) => void
}) {
  const apiKey = String(opts.apiKey || '').trim()
  const botId = String(opts.botId || '').trim()
  const endpoint = String(opts.endpoint || 'https://open.feedcoopapi.com/agent_api/agent/chat/completion').trim()
  if (!apiKey) throw new Error('缺少服务端环境变量：VOLCENGINE_AGENT_API_KEY')
  if (!botId) throw new Error('缺少服务端环境变量：VOLCENGINE_AGENT_BOT_ID')
  if (!endpoint) throw new Error('缺少火山智能体会话接口地址')

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json, text/plain',
    },
    body: JSON.stringify({
      bot_id: botId,
      messages: opts.messages.slice(-10),
      stream: opts.stream !== false,
      model: opts.model || 'thinking',
      ...(opts.userId ? { user_id: opts.userId } : {}),
    }),
    signal: opts.signal,
  })

  if (!upstream.ok) {
    const msg = await upstream.text().catch(() => '')
    throw new Error(`火山智能体调用失败：HTTP ${upstream.status} ${msg}`)
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
    const j = (await upstream.json().catch(() => null)) as Record<string, unknown> | null
    if (j && typeof j === 'object') {
      const { answer, reasoning } = pickTextFromChunk(j)
      if (reasoning) opts.onEvent({ type: 'reasoning', content: reasoning })
      if (answer) opts.onEvent({ type: 'answer', content: { answer }, finish: true })
    }
    opts.onEvent({ type: 'end', status: 'success' })
    return
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
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
        if (!data) continue
        if (data === '[DONE]') {
          done = true
          break
        }
        try {
          const j = JSON.parse(data) as unknown
          if (!j || typeof j !== 'object') continue
          const { answer, reasoning, done: d } = pickTextFromChunk(j as Record<string, unknown>)
          if (reasoning) opts.onEvent({ type: 'reasoning', content: reasoning })
          if (answer) opts.onEvent({ type: 'answer', content: { answer }, finish: false })
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

  opts.onEvent({ type: 'end', status: 'success' })
}

