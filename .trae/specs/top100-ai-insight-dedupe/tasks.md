# Tasks
- [x] 任务 1：补齐数据库模型（Supabase）
  - [x] 新增表 `top100_insight`（按 `data_date` 唯一，语义为 Top200 解读）
  - [x] 明确字段：data_date、snapshot_at、source、content_md、created_at/updated_at
  - [x] 配置 RLS/权限：前端不直连写；后端使用服务端密钥写入

- [x] 任务 2：改造 AI 路由为“读取 + 幂等生成”
  - [x] 新增读取接口：`GET /api/ai/top100/insight?dataDate=YYYY-MM-DD`
  - [x] 将现有 `POST /api/ai/top100/insight` 改为内部生成入口或移除公开触发能力（对外不可用）
  - [x] 在服务端实现幂等：同 `dataDate` 只允许一次写入（并发请求不重复调用 Coze）

- [x] 任务 3：在“新交易日快照出现”时自动触发生成
  - [x] 用户点击“重新获取”路径：当返回的新 `meta.dataDate` 变化时，触发 ensure（生成并落库）
  - [x] 定时任务路径：`refreshTop100Snapshot.ts` 写入新快照后触发 ensure
  - [x] 失败重试策略：写入失败/Coze 失败要可观测（日志/状态字段），但不允许前端手动触发

- [x] 任务 4：前端 AI 解读面板改为只读
  - [x] `Top100InsightPanel` 移除“生成/重试”按钮与流式读取逻辑
  - [x] 根据 `meta.dataDate` 读取数据库解读内容并展示（Markdown）
  - [x] 无内容时展示“尚未生成/等待后台生成”提示

- [x] 任务 5：验证与回归
  - [x] 同交易日重复打开不再触发 Coze（仅读库）
  - [x] 新交易日产生时自动生成并落库（重新获取/定时任务两条路径）
  - [x] 并发情况下不重复写入（唯一约束 + 幂等逻辑）
  - [x] `npm run check` / `npm run build` 通过

# Task Dependencies
- 任务 2 依赖 任务 1
- 任务 3 依赖 任务 1、任务 2
- 任务 4 依赖 任务 2
- 任务 5 依赖 任务 1-4
