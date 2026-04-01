# Tasks
- [x] Task 1: 大盘看板 AI 解读更换默认模型
  - [x] 将 `/api/ai/market/insight` 默认 `AIHUBMIX_MODEL` 从 `coding-minimax-m2.7-free` 调整为 `gpt-4.1-free`
  - [x] 确保仅影响 market/insight 路由，不触碰 Top200 列表解读链路（Coze + top100_insight）

- [x] Task 2: 指标字段字典（含义与单位/口径）
  - [x] 为大盘看板输入上下文补充 `indicatorDictionary`（字段 → {meaning, unit, notes}）
  - [x] 明确股债利差 value 的语义（收益率差值，单位为比率；可额外给出换算为 %p 的说明）

- [x] Task 3: 指标趋势驱动的搜索 queries 生成
  - [x] 从多周期摘要与近 20 日变化中提取趋势要素（趋势强弱、波动收敛/扩张、流动性指数、股债分位区间）
  - [x] 生成 3–8 条 queries（包含“沪深300/大盘/流动性/北向/债券收益率/政策/宏观”等方向），并限制时间范围为近 7–14 天
  - [x] 在 prompt 中要求模型引用权威来源 URL，并将“指标结论 vs 资讯归因”分开说明

- [x] Task 4: 前端折叠调试面板
  - [x] 调试信息默认折叠（不占屏幕）
  - [x] 展示完整请求参数：enableWebSearch、最终 model、queries、developer/system prompt、user prompt
  - [x] 确保敏感信息不出现在前端（不展示 API key 等）

- [x] Task 5: 校验与回归
  - [x] `npm run check` 通过
  - [x] 确认 Top200 列表解读文案与生成链路未改变（代码层面无修改）

# Task Dependencies
- Task 3 depends on Task 2
- Task 4 depends on Task 1 and Task 3
