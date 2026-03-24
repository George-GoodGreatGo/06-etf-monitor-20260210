# Tasks

- [x] Task 1: 新增后端 ETF 详情页解读流式接口
  - [x] 在 `server/routes/ai.ts` 新增 `POST /api/ai/etf/detail/insight`（SSE）。
  - [x] 服务端根据 `code` 构造输入 JSON（结构对齐 `513130_weekly_qfq_indicators_named.json`），包含 `symbol/name_cn/adjustment/freq/data[]` 等字段。
  - [x] 调用 `COZE_DETAIL_STREAM_RUN_URL`，使用 `COZE_DETAIL_BEARER_TOKEN` 鉴权，并将上游 SSE 解析后转发给前端（逐段推送）。
  - [x] 在缺少环境变量或上游失败时返回明确错误事件，避免前端无响应。

- [x] Task 2: 复用/扩展 Coze SSE 解析工具
  - [x] 在 `server/lib/coze.ts` 复用现有 SSE 解析逻辑，为“边读边转发”提供能力（例如支持回调/生成器式输出）。
  - [x] 确保前端收到的事件 JSON 形态与 Spec 中的 Data Contract 兼容。

- [x] Task 3: 详情页新增【数据解读模块】并支持流式展示
  - [x] 在 `src/pages/EtfDetail.tsx` 的周线图表下方加入模块 UI（标题+按钮+输出区域）。
  - [x] 点击【开始解读】后，使用 `fetch` 调用后端 SSE 接口并消费 `ReadableStream`，解析 `data:` 行中的 JSON 事件。
  - [x] 模块状态包含：idle / running / done / error，并按要求展示“正在调用模型进行解读，请稍后”。
  - [x] 输出区域优先按 Markdown 渲染（与现有解读面板风格一致），并对纯文本回退展示。

- [x] Task 4: 验证与回归
  - [x] 在缺少 `COZE_DETAIL_BEARER_TOKEN` 时能正确提示错误。
  - [x] 以 `513130` 为例，点击【开始解读】可看到流式输出，完成后状态正确收敛。
  - [x] 不在前端产物中包含 Coze token（仅服务端环境变量使用）。

# Task Dependencies
- Task 3 depends on Task 1
- Task 1 depends on Task 2（可并行开始，但需统一事件协议）
