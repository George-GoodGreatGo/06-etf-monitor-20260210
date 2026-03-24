# ETF 详情页交易机会解读 (Coze) Spec

## Why
ETF 详情页已具备周线与多指标数据，但缺少对“交易机会/风险”的结构化解读。通过 Coze 智能体对指标 JSON 进行流式解读，可提升用户决策效率与可读性。

## What Changes
- **后端 (Backend)**：
  - 新增“ETF 详情页解读”流式接口：接收 `code`，生成与 [513130_weekly_qfq_indicators_named.json](file:///d:/A-AI%E5%AD%A6%E4%B9%A0/T-Trae%E5%9B%BD%E9%99%85%E7%89%88/06-etf-monitor-20260210/debug/513130_weekly_qfq_indicators_named.json) 相同结构的 JSON 作为入参，调用 Coze `stream_run`，并将结果以 SSE 方式回传前端。
  - Coze 鉴权 token 仅保存在服务端环境变量中；前端不直接持有 token。
  - 为避免与“列表页解读”混淆，本功能使用**独立的**环境变量命名（详情页专用 Coze URL 与 token）。
- **前端 (Frontend)**：
  - 在 ETF 详情页周线图表下方新增【数据解读模块】。
  - 模块提供【开始解读】按钮；点击后进入“调用中”状态并展示流式输出内容。
  - 根据服务端推送的 SSE JSON 事件解析并渲染内容，优化展示样式（以 Markdown 为主，兼容纯文本）。

## Impact
- Affected code:
  - `src/pages/EtfDetail.tsx`
  - `server/routes/ai.ts`
  - `server/lib/coze.ts`（复用/扩展现有 Coze SSE 解析逻辑）
  - `server/routes/etf.ts`（复用周线数据结构或补充 ETF 名称来源）

## ADDED Requirements
### Requirement: 详情页数据解读模块
系统 SHALL 在 ETF 详情页周线图表下方提供一个【数据解读模块】。

#### Scenario: 初始状态
- **WHEN** 用户打开 ETF 详情页
- **THEN** 模块展示【开始解读】按钮与空态提示（例如“点击开始解读，将基于周线指标生成交易机会解读”）

### Requirement: 触发解读并调用 Coze
系统 SHALL 在用户点击【开始解读】后，以“仅 JSON 入参”的方式调用 Coze `stream_run` 接口进行解读。

#### Scenario: 点击开始解读
- **WHEN** 用户点击【开始解读】
- **THEN** 前端调用后端流式接口（携带 `code`）
- **AND** 后端构造输入 JSON（结构与示例文件一致），并将 JSON 字符串作为 Coze 入参（不附加额外 prompt 文本）
- **AND** 模块状态显示为“正在调用模型进行解读，请稍后”

### Requirement: 流式展示结果
系统 SHALL 以流式方式展示 Coze 返回内容。

#### Scenario: 流式输出
- **WHEN** 后端从 Coze 上游收到新的 SSE 事件片段
- **THEN** 后端将片段以 SSE `data: { ...json... }` 推送给前端
- **AND** 前端解析 JSON 字段并增量更新展示内容（优先按 Markdown 渲染；不支持的内容回退为纯文本）
- **AND** 上游结束后，前端将状态变为“已完成”

### Requirement: 安全与配置
系统 SHALL 不在前端暴露 Coze token，并使用环境变量配置 Coze URL 与 token。

#### Scenario: 环境变量缺失
- **WHEN** 服务端缺少 `COZE_DETAIL_BEARER_TOKEN` 或 `COZE_DETAIL_STREAM_RUN_URL`
- **THEN** 后端返回明确错误；前端展示失败提示

## MODIFIED Requirements
### Requirement: 详情页 UI 布局
详情页周线图表下方新增一个模块区域，不影响既有“周线图表”与下方占位模块布局。

## REMOVED Requirements
N/A

## Data Contract
### Coze 调用
- URL：由 `COZE_DETAIL_STREAM_RUN_URL` 提供（默认值为 `https://42w6vymmpd.coze.site/stream_run`）
- Authorization：`Bearer ${COZE_DETAIL_BEARER_TOKEN}`（仅服务端使用）
- 入参：JSON 字符串（即示例文件结构，直接 `JSON.stringify(payload)`）

### 前端消费的 SSE 事件
后端对前端输出的 SSE 每条 `data:` 都是 JSON，至少兼容以下形态：
- `{ "type": "content", "content": "..." }`
- `{ "type": "answer", "content": { "answer": "..." }, "finish": false|true }`
- `{ "type": "end", "status": "success" | "error", "message"?: "..." }`
