# 沪深市场大盘看板：AI 解读模块 Spec

## Why
目前大盘看板已沉淀了关键技术指标，但缺少“把指标翻译成可执行的情绪/机会/风险判断”的层。增加用户点击触发的 AI 解读，可降低信息负担，帮助用户冷静决策。

## What Changes
- 前端：在「沪深市场大盘看板」页面下方新增【AI 解读】模块，用户点击按钮后生成并展示解读（支持流式输出）。
- 后端：新增“市场看板 AI 解读”流式接口（SSE），后端聚合多时间段的指标与摘要（短/中/长周期），构造成结构化上下文，调用模型生成 Markdown 解读并回传。
- 配置：新增服务端环境变量用于配置 AIHubMix（OpenAI 兼容 Chat Completions 接口）。
- 约束：未接入新闻源时，AI 解读不得编造“关键事件/新闻”；相关段落必须显式标注“未接入新闻/事件数据，仅基于指标推断”。

## Impact
- Affected specs: 现有「大盘看板」图表/表格与指标说明（新增一个下方模块，不破坏现有功能）。
- Affected code:
  - `src/components/MarketLiquidityPanel.tsx`（新增 AI 解读模块区域与状态管理）
  - `server/routes/ai.ts`（新增市场看板解读 SSE 路由）
  - `server/routes/market.ts` 或现有市场数据构造函数（复用 /market/liquidity/v5 数据）
  - `src/utils/marketApi.ts`（新增前端调用接口，若需要）

## 参考项目分析（供实现取舍）
用户提供的参考项目（daily_stock_analysis）体现了几个可借鉴点：
- “上下文结构化”：将行情、指标、舆情/新闻等聚合为结构化上下文，再交给 LLM 输出决策仪表盘，有助于稳定输出质量。
- “fail-open 降级”：多数据源/多模块中，允许部分模块失败但整体仍可输出（并在结果中标明缺失项），提升可用性。
- “成本与体验”：通过缓存/复用（同一日期/同一标的）减少重复调用；通过推送/定时任务实现“每天自动复盘”。
本项目落地建议分阶段：
- Phase 1（本次范围）：只做“基于现有指标的 AI 解读”（不接入新闻/舆情），保证不编造事件。
- Phase 2（可选）：引入新闻/公告检索（需要可追溯来源与时间范围），并将“关键事件”改为“带来源引用”的事实摘要。
- Phase 3（可选）：加入缓存与定时生成（如 Supabase 存储 + 定时任务），并可选多渠道推送。

## ADDED Requirements
### Requirement: 大盘看板 AI 解读模块
系统 SHALL 在沪深市场大盘看板页面下方提供一个【AI 解读】模块。

#### Scenario: 初始状态
- **WHEN** 用户打开大盘看板
- **THEN** 展示【生成 AI 解读】按钮与空态说明（提示：将基于短/中/长周期指标摘要 + 近期 3–7 个交易日变化生成解读）
- **AND** 不自动调用模型（避免无意消耗额度）
- **AND** 默认勾选【联网补充资讯】开关

### Requirement: 触发生成并流式展示
系统 SHALL 在用户点击【生成 AI 解读】后，以 SSE 流式方式展示模型输出内容。

#### Scenario: 生成成功
- **GIVEN** 后端已配置可用的模型调用参数
- **WHEN** 用户点击【生成 AI 解读】
- **THEN** 前端进入“生成中”状态并展示流式输出
- **AND** 生成完成后标记“已完成”，保留本次结果

#### Scenario: 生成失败
- **WHEN** 后端返回错误（配置缺失/上游异常/超时）
- **THEN** 前端展示失败原因，并提供【重试】入口
- **AND** 数据状态栏（若已有）不被误导为“数据已就绪”

### Requirement: 输入上下文（指标）构造
系统 SHALL 使用“结构化上下文”而非纯拼接文本作为模型输入。

#### Scenario: 多周期输入（符合常见复盘习惯）
- **GIVEN** 指标摘要使用多周期：5 / 20 / 60 / 120 / 252 交易日（数据不足时按可用窗口降级）
- **AND** “近期变化”窗口使用 3–7 个交易日（用于情绪/短期波动描述）
- **WHEN** 用户触发解读
- **THEN** 后端从现有市场数据接口/函数获取：
  - 沪深300：close、EMA20、EMA60、BOLL120（MB/UB/LB/BW）
  - 流动性：成交额/分位、换手率/分位、北向资金/分位、V5
  - 股债：PE、1/PE、10Y、股债利差 value、股债分位 pct
- **AND** 同时计算必要的“多周期摘要”与“近期变化摘要”，至少包含：
  - 沪深300：5/20/60/120/252 日涨跌幅（或收益率）与趋势方向（如价格相对 EMA20/EMA60）
  - BOLL120：带宽（BW）水平与近期变化（如 20 日相对变化）
  - V5：当前所处区间（<30 / 30–70 / >70）以及近 60/120 日处于机会区/风险区的占比
  - 股债：股债利差与分位在近 60/120/252 日的变化（例如是否处于高分位区间）

### Requirement: 输出格式与安全约束
系统 SHALL 输出为 Markdown 文本，并遵守不编造事实的约束。

#### Scenario: 未接入新闻/事件数据
- **GIVEN** 当前系统未提供“新闻/公告/宏观事件”数据输入
- **WHEN** 模型生成“关键事件”相关内容
- **THEN** 输出必须明确写明“未接入新闻/事件数据，仅基于指标与价格行为推断，不代表真实事件”
- **AND** 不得输出具体“某某政策/某公司事件/某日发生XX”这类事实断言

#### Scenario: 免责声明
- **WHEN** 输出生成
- **THEN** 必须包含“仅供参考，不构成投资建议”的提示

## Data Contract
### 前端 -> 后端（建议）
- POST `/api/ai/market/insight`
- body:
  - `indicatorHorizon`: 'short' | 'medium' | 'long'（可选，默认 'medium'；仅影响解读侧重点，不改变底层多周期摘要的计算）
  - `recentDays`: number（可选，3–7，默认 7；用于“近期变化/情绪”描述）
  - `enableWebSearch`: boolean（可选，默认 true；仅用于“近期资讯/关键事件”段落）

### 后端 -> 前端（SSE 事件）
每条 `data:` 为 JSON，兼容以下形态：
- `{ "type": "answer", "content": { "answer": "Markdown片段" }, "finish": false }`
- `{ "type": "end", "status": "success" }`
- `{ "type": "end", "status": "error", "message": "错误原因" }`

### 服务端环境变量（AIHubMix）
- `AIHUBMIX_BASE_URL`：默认 `https://aihubmix.com/v1`
- `AIHUBMIX_API_KEY`：服务端密钥（仅服务端保存）
- `AIHUBMIX_MODEL`：默认 `coding-minimax-m2.7-free`
- `AIHUBMIX_ENABLE_SURFING`：可选，默认 `1`；`1` 表示在启用联网时使用 `model:surfing` 后缀（用于任意模型的联网搜索）

### 联网搜索策略
- 当 `enableWebSearch=true` 时：
  - 若使用 `model:surfing` 方式：将模型 ID 变为 `${AIHUBMIX_MODEL}:surfing`，由 AIHubMix 通过 Tavily 进行搜索增强；并要求模型在“关键事件/资讯”部分给出可追溯的链接或来源描述。
  - 若后续改用 OpenAI/Gemini 原生搜索模型或 `web_search_options={}` 方式：仅在模型本身支持时启用，并在 spec 更新中明确该模型清单与费用口径。
