# Tasks
- [x] Task 1: 设计 AI 解读上下文与输出结构
  - [x] 明确多周期（5/20/60/120/252 交易日）输入字段与摘要衍生字段（收益、趋势、分位变化、区间占比等）
  - [x] 明确近期窗口（3–7 交易日）的“情绪/波动”摘要字段
  - [x] 明确 Markdown 输出模板（情绪/风险机会/估值/流动性/观察清单/免责声明）
  - [x] 明确“未接入新闻时禁止编造事件”的约束文案

- [x] Task 2: 后端新增市场看板 AI 解读 SSE 接口
  - [x] 在 `server/routes/ai.ts` 增加 `POST /api/ai/market/insight`
  - [x] 拉取市场看板指标数据（复用 `/api/market/liquidity/v5` 或相同构造逻辑）并计算多周期摘要 + 近期摘要
  - [x] 构造结构化 JSON 上下文并调用 AIHubMix（OpenAI 兼容 Chat Completions；配置缺失需返回明确错误）
  - [x] 支持可选联网：`enableWebSearch=true` 时使用 `${model}:surfing`（仅用于“近期资讯/关键事件”段落）
  - [x] 将结果以 SSE 事件流输出给前端（复用现有 SSE event 形态）

- [x] Task 3: 前端新增“AI 解读”模块
  - [x] 在 `MarketLiquidityPanel.tsx` 页面底部加入模块区块（按钮 + 流式内容区域）
  - [x] 增加【联网补充资讯】开关（默认勾选），并随请求发送 `enableWebSearch`
  - [x] 处理状态：idle / loading / success / error，并支持重试
  - [x] Markdown 渲染（优先复用项目已存在的渲染方案；无则先纯文本）

- [x] Task 4: 端到端校验与体验优化
  - [x] 校验：无数据/接口报错时能展示明确原因
  - [x] 校验：生成中有加载态，完成后可复制/滚动查看
  - [x] 增加最小化的防抖/并发保护（避免重复点击并发请求）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
