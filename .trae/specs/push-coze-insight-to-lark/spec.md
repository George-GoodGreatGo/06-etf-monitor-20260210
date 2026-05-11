# ETF200 Coze解读日志推送飞书 Spec

## Why
每天ETF200列表的Coze解读日志生成后，目前只能通过前端面板查看。需要将解读内容自动推送到飞书群机器人，方便团队成员在飞书中直接阅读每日ETF异动解读。

## What Changes
- 新增 `server/lib/larkBot.ts`：封装飞书机器人消息推送（文本/markdown消息发送）
- 修改 `server/lib/top100Insight.ts`：在 `ensureTop100Insight` 解读成功写入 Supabase 后，异步推送 markdown 内容到飞书
- 修改 `.github/workflows/refresh-top100.yml`：增加 `LARK_BOT_WEBHOOK_URL` 环境变量注入

## Impact
- Affected specs: 无（新增能力，不影响已有链路）
- Affected code: `server/lib/top100Insight.ts`, `server/lib/larkBot.ts`（新增）, `.github/workflows/refresh-top100.yml`

## ADDED Requirements

### Requirement: 飞书机器人消息推送
系统 SHALL 在 ETF200 Coze 解读日志成功生成并写入 Supabase 后，将解读 markdown 内容推送到指定飞书群机器人。

#### Scenario: 解读生成成功后正常推送
- **WHEN** `ensureTop100Insight` 成功调用 Coze 生成 markdown 并写入 `top100_insight` 表
- **THEN** 系统将 markdown 内容以飞书消息卡片形式发送到 `LARK_BOT_WEBHOOK_URL` 指定的 Webhook 地址
- **AND** 消息标题格式为「ETF200 异动解读 — YYYY-MM-DD」

#### Scenario: 飞书推送失败不影响主流程
- **WHEN** 飞书 Webhook 调用失败（网络错误/限流/服务端错误）
- **THEN** 系统记录错误日志但不抛出异常
- **AND** `ensureTop100Insight` 仍正常返回解读结果，状态仍标记为 `ready`

#### Scenario: 环境变量未配置时静默跳过
- **WHEN** `LARK_BOT_WEBHOOK_URL` 环境变量未设置或为空
- **THEN** 系统跳过飞书推送，不报错

### Requirement: 飞书消息格式
系统 SHALL 使用飞书消息卡片格式发送解读内容，确保可读性。

#### Scenario: 消息内容结构
- **WHEN** 推送解读到飞书
- **THEN** 消息 `msg_type` 为 `interactive`
- **AND** 卡片标题包含数据日期
- **AND** 卡片正文为 Coze 生成的 markdown 内容（飞书支持的 markdown 子集）
