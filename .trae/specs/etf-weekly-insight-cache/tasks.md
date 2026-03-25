# Tasks

- [x] Task 1: 准备后端数据库逻辑
  - [x] SubTask 1.1: 在 `server/lib/supabaseRest.ts` 中新增读取 ETF 解读记录的函数 `getEtfWeeklyInsight(code)`。
  - [x] SubTask 1.2: 在 `server/lib/supabaseRest.ts` 中新增写入/更新 ETF 解读记录的函数 `upsertEtfWeeklyInsight(code, insightText)`。
  - [x] SubTask 1.3: (如果需要的话，手动在 Supabase 控制台创建 `etf_weekly_insight` 表，包含 `code` text PK, `insight_text` text, `created_at` timestamptz 字段)。

- [x] Task 2: 更新后端 API
  - [x] SubTask 2.1: 在 `server/routes/ai.ts` 中新增一个 GET 接口 `/api/ai/etf/detail/insight/:code` 用于获取指定 ETF 的最近一次解读，判断其是否在 23 小时内，如果在则返回记录，否则返回空或过期提示。
  - [x] SubTask 2.2: 在 `server/routes/ai.ts` 的流式接口 `/api/ai/etf/detail/insight` 中，收集流式输出的完整文本，在流结束（`event === 'done'`）时，调用 `upsertEtfWeeklyInsight` 将完整结果保存到数据库。

- [x] Task 3: 更新前端 UI 和逻辑
  - [x] SubTask 3.1: 在 `src/pages/EtfDetail.tsx` 加载 ETF 详情时，增加对 GET `/api/ai/etf/detail/insight/:code` 的请求。
  - [x] SubTask 3.2: 如果该接口返回了有效且未过期（<=23小时）的解读结果，则直接将结果设置到 `insightText` 状态中，并将状态置为 `done`。
  - [x] SubTask 3.3: 调整页面上的“开始解读”按钮：如果已有结果，可以不显示或显示“重新解读”等（按需），以保证用户体验自然。
