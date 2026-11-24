const MAX_CONTENT_LENGTH = 20000

// Grace 的 Grok Bot（Cursor Automation Webhook），可通过环境变量覆盖
const DEFAULT_WEBHOOK_URL =
  'https://api2.cursor.sh/automations/webhook/e718c5e0-3a56-524c-93ff-aaeda97f9b40'
const DEFAULT_AUTH_TOKEN =
  'crsr_8af31011a2e2d2da8b672042df151c16cd5d12ea3f4b07444749288756b64f76'
const DEFAULT_SITE_URL = 'https://traemqq87e12.vercel.app'
const INSIGHT_PAGE_PATH = '/market'

export async function sendGrokBotDailyReport(input: {
  title: string
  dataDate: string
  markdown: string
}): Promise<boolean> {
  const webhookUrl = (process.env.GROK_BOT_WEBHOOK_URL || DEFAULT_WEBHOOK_URL).trim()
  const authToken = (process.env.GROK_BOT_AUTH_TOKEN || DEFAULT_AUTH_TOKEN).trim()
  if (!webhookUrl) return false

  let content = input.markdown
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n...[内容过长已截断]'
  }

  const siteUrl = (process.env.APP_SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '')
  const body = {
    title: input.title,
    date: input.dataDate,
    link: `${siteUrl}${INSIGHT_PAGE_PATH}`,
    content,
    source: 'ETF Monitor · ETF200 异动解读',
    pushedAt: new Date().toISOString(),
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(
        `[grokBot] sendGrokBotDailyReport failed: HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`,
      )
      return false
    }
    return true
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn('[grokBot] sendGrokBotDailyReport timeout')
    } else {
      console.warn('[grokBot] sendGrokBotDailyReport error:', e instanceof Error ? e.message : String(e))
    }
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}
