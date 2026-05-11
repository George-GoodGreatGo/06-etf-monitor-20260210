# Checklist

- [x] `server/lib/larkBot.ts` 文件存在且导出 `sendLarkMarkdownCard` 函数
- [x] `sendLarkMarkdownCard` 在 `LARK_BOT_WEBHOOK_URL` 未设置时返回 `false`
- [x] `sendLarkMarkdownCard` 使用 `fetch` 向飞书 Webhook 发送 POST 请求，超时 10 秒
- [x] `sendLarkMarkdownCard` 请求失败时仅 `console.warn`，返回 `false`
- [x] `sendLarkMarkdownCard` 返回 `Promise<boolean>`（`true`=推送成功，`false`=跳过/失败）
- [x] `supabase/migrations/0004_top100_insight_lark_pushed.sql` 添加 `lark_pushed_at timestamptz` 列
- [x] `Top100InsightRow` 类型包含 `lark_pushed_at?: string | null`
- [x] `updateTop100InsightLarkPushed` 函数存在于 supabaseRest.ts，用 PATCH 更新
- [x] `ensureTop100Insight` 外层早期返回路径：仅在 `!existing.lark_pushed_at` 时推送
- [x] `ensureTop100Insight` 正常成功路径：仅在 `!out.lark_pushed_at` 时推送
- [x] 推送成功后调用 `updateTop100InsightLarkPushed(d).catch(() => {})` 记录时间戳
- [x] 消息标题格式为「ETF200 异动解读 — {dataDate}」
- [x] `.github/workflows/refresh-top100.yml` 包含 `LARK_BOT_WEBHOOK_URL` 环境变量注入
- [x] `npm run check`（`tsc --noEmit`）通过，无类型错误
