# ETF Weekly Insight Cache Spec

## Why
目前，用户每次点击“开始解读”都会调用 Coze 模型进行数据解读。这不仅会消耗不必要的模型 token，还增加了用户的等待时间。我们需要增加一个数据记录机制，对于同一个 ETF，如果在 23 小时内已经有过解读，则直接展示上一次的解读结果，以优化性能和成本。

## What Changes
- 在后端提供一个检查并返回已有解读记录的机制（使用 Supabase 表存储）。
- 新增 Supabase 表 `etf_weekly_insight`，用于存储各个 ETF 的最新解读结果及其生成时间。
- 前端在访问 ETF 详情页时，先检查是否存在有效的缓存记录。如果有，则展示上一次的解读结果（可跳过调用 Coze）；如果没有，再允许用户点击“开始解读”（或者直接通过原来的流式调用生成新解读）。
- 后端在成功完成 Coze 流式调用或接收到完整结果后，将解读结果和时间戳写入 `etf_weekly_insight` 表中。

## Impact
- Affected specs: ETF 详情页 AI 解读模块。
- Affected code:
  - `src/pages/EtfDetail.tsx` (前端 UI 状态和请求逻辑)
  - `server/routes/ai.ts` (后端调用 AI 及写库逻辑)
  - `server/lib/supabaseRest.ts` (后端读写数据库封装)
- 新增数据表: `etf_weekly_insight` (字段: `code`, `insight_text`, `created_at`)

## ADDED Requirements
### Requirement: 记录并复用 AI 解读
系统 SHALL 对生成的 ETF 周线 AI 解读进行记录，并在 23 小时内复用。

#### Scenario: 存在近期有效解读
- **GIVEN** 数据库中存在该 ETF 的解读记录
- **AND** 记录的 `created_at` 距离当前时间 <= 23 小时
- **WHEN** 用户进入该 ETF 详情页并请求 AI 解读
- **THEN** 系统直接返回并展示该记录的内容
- **AND** 不调用 Coze API

#### Scenario: 无有效解读
- **GIVEN** 数据库中不存在该 ETF 的解读记录
- **OR** 记录的 `created_at` 距离当前时间 > 23 小时
- **WHEN** 用户请求 AI 解读
- **THEN** 系统调用 Coze API 生成新的解读
- **AND** 在生成完成后，将新解读和当前时间存入或更新到数据库中
