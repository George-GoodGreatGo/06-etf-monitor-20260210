# Top200 AI 解读“按交易日唯一生成并落库”Spec

## Why
当前“AI 解读”每次打开/点击都会直接调用 Coze 生成，造成重复消耗、结果不一致、以及用户可绕过缓存反复拉取的问题。需要把解读变为“按交易日唯一生成”的快照资产，统一落库并复用。

## What Changes
- “AI 解读”改为**只读展示**：同一交易日（dataDate）只允许生成一次并写入数据库；同一交易日再次打开仅从数据库读取，不允许用户再触发 Coze。
- 新增“Top200 AI 解读快照”数据表（Supabase），以 `data_date` 作为唯一键，存储生成内容与快照元信息。
- 说明：当前 Supabase 快照表名为 `top100_latest`，但实际承载的是 Top200 数据（常用 limit=200）；本变更保持表名不改，仅在语义与 UI 上统一称为 Top200。
- 调整后端 AI 路由：
  - 提供只读接口：按 `dataDate` 读取已生成解读。
  - 提供内部生成能力：在检测到新交易日 Top200 快照后，自动触发一次 Coze 生成并写入数据库（带幂等/去重）。
- 调整“重新获取”与定时刷新流程：
  - 当“重新获取”得到新交易日快照时，自动触发 Coze 生成并入库（遵循唯一生成规则）。
  - 定时获取任务写入新交易日快照时，同步自动触发 Coze 生成并入库（同理）。
- **BREAKING**：前端不再提供“生成/重试/重新拉取 Coze”的交互入口。

## Impact
- Affected specs: 首页 AI 解读交互、后台刷新流程、数据库表结构
- Affected code（预期）:
  - `src/components/Top100InsightPanel.tsx`
  - `server/routes/ai.ts`
  - `server/routes/etf.ts`（在 refresh 或返回快照时触发 ensure）
  - `server/lib/supabaseRest.ts`（新增读写 AI 解读表的封装）
  - `server/scripts/refreshTop100Snapshot.ts`（定时刷新后触发生成）

## ADDED Requirements
### Requirement: AI 解读按交易日唯一生成
系统 SHALL 对同一交易日（`dataDate`）的 Top200 快照仅调用 Coze 生成一次解读，并将结果写入数据库。

#### Scenario: 新交易日首次生成
- **GIVEN** 数据库中不存在 `dataDate=2026-02-25` 的解读记录
- **WHEN** 系统检测到 `top100_latest.data_date=2026-02-25` 的快照需要生成解读（该快照实际包含 Top200 行）
- **THEN** 系统调用 Coze 生成解读
- **AND** 将生成结果写入数据库（以 `data_date` 唯一约束保证只生成一次）

#### Scenario: 同交易日重复访问
- **GIVEN** 数据库中已存在 `dataDate=2026-02-25` 的解读记录
- **WHEN** 用户打开“AI 解读”页面或刷新页面
- **THEN** 系统只从数据库返回已有解读
- **AND** 不再调用 Coze

### Requirement: AI 解读读取接口
系统 SHALL 提供只读接口用于按交易日获取已生成的 AI 解读内容。

#### Scenario: 成功读取
- **WHEN** 客户端请求 `GET /api/ai/top100/insight?dataDate=YYYY-MM-DD`
- **THEN** 返回该 `dataDate` 的解读内容与元信息（快照时间、来源、生成时间）

#### Scenario: 尚未生成
- **GIVEN** 数据库中不存在该 `dataDate` 的解读记录
- **WHEN** 客户端请求读取
- **THEN** 返回明确的未生成状态（例如 404/204 或 `success:true, data:null`，以实现为准）
- **AND** 客户端不得提供“强制从 Coze 拉取”的按钮入口

### Requirement: 新交易日自动触发生成
系统 SHALL 在获取到新交易日快照时自动触发一次解读生成与落库。

#### Scenario: 用户点击“重新获取”并得到新交易日
- **WHEN** 用户点击右上角“重新获取”，系统拿到的快照 `dataDate` 与上一次不同
- **THEN** 系统自动触发 Coze 解读生成并落库
- **AND** 列表页（Top200）与 AI 解读均使用同一交易日口径

#### Scenario: 定时任务获取新交易日
- **WHEN** 定时任务写入 `top100_latest` 为新交易日快照
- **THEN** 定时任务在同一流程中自动触发解读生成并落库

## MODIFIED Requirements
### Requirement: 前端 AI 解读交互
前端 SHALL 将“AI 解读”改为只读展示：
- 不提供“生成/重试/重新拉取 Coze”按钮
- 若解读不存在，展示“尚未生成/等待后台生成”的提示与快照信息

## REMOVED Requirements
### Requirement: 用户主动触发 Coze 生成
**Reason**: 避免同交易日重复调用、保证解读一致性与成本可控。
**Migration**: 由“新交易日快照产生时自动生成并落库”替代；前端仅读取数据库结果。

## Data Contract
建议新增表 `top100_insight`（字段可微调；表名可沿用 Top100 历史命名但承载 Top200 语义）：
- `data_date` (text, PK/unique)
- `snapshot_at` (timestamptz/text)
- `source` (text)
- `content_md` (text) 生成结果（Markdown）
- `coze_session_id` (text, optional)
- `created_at` / `updated_at` (timestamptz)
