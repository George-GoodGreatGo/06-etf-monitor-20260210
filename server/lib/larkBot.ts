const MAX_CONTENT_LENGTH = 10000

export async function sendLarkMarkdownCard(title: string, markdownContent: string): Promise<boolean> {
  const webhookUrl = (process.env.LARK_BOT_WEBHOOK_URL || '').trim()
  if (!webhookUrl) return false

  let content = markdownContent
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n...[内容过长已截断]'
  }

  const body = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: title,
        },
      },
      elements: [
        {
          tag: 'markdown',
          content,
        },
      ],
    },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(
        `[larkBot] sendLarkMarkdownCard failed: HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`,
      )
      return false
    }
    return true
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn('[larkBot] sendLarkMarkdownCard timeout')
    } else {
      console.warn('[larkBot] sendLarkMarkdownCard error:', e instanceof Error ? e.message : String(e))
    }
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}
