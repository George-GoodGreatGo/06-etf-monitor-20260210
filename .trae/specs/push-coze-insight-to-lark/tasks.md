# Tasks

- [x] Task 1: 创建 `server/lib/larkBot.ts`，封装飞书机器人消息推送
  - [x] 实现 `sendLarkMarkdownCard` 函数：发送飞书消息卡片（`msg_type: interactive`），包含标题和 markdown 正文
  - [x] 从 `LARK_BOT_WEBHOOK_URL` 环境变量读取 Webhook URL，未配置时静默返回
  - [x] 使用 Node.js 内置 `fetch` 发起 HTTP POST，设置超时（10s）
  - [x] 错误时仅 `console.warn`，不向上抛出

- [x] Task 2: 修改 `server/lib/top100Insight.ts`，在解读成功后调用飞书推送
  - [x] 在 `ensureTop100Insight` 中，markdown 生成并写入 Supabase 成功后，调用 `sendLarkMarkdownCard`
  - [x] 使用 `.catch()` 包裹推送调用，确保推送失败不影响主流程
  - [x] 消息标题格式：「ETF200 异动解读 — {dataDate}」

- [x] Task 3: 修改 `.github/workflows/refresh-top100.yml`，注入飞书 Webhook 环境变量
  - [x] 在 `env` 配置块中新增 `LARK_BOT_WEBHOOK_URL: ${{ secrets.LARK_BOT_WEBHOOK_URL }}`

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 可与其他任务并行
