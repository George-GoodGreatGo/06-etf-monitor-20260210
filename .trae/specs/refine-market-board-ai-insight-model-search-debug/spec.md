# 沪深市场大盘看板：AI 解读模型/搜索/调试增强 Spec

## Why
当前大盘看板 AI 解读已可用，但在“模型选择、联网检索的可控性、指标语义可解释性、以及可观测调试信息”方面仍不够满足分析与迭代需求。

## What Changes
- 后端：大盘看板 AI 解读默认模型改为 `doubao-seed-2-0-pro`（仅影响 `/api/ai/market/insight`），并开启深度思考（`thinking={"type":"enabled"}`）。
- 后端：联网检索阶段引入“由指标趋势驱动的检索 query 生成”，并要求模型基于检索结果进行归因总结（引用权威来源链接）。
- 后端：向模型提供指标时补充“字段含义 + 单位/口径”（例如 点、%、万元、分位%、无量纲、利差为比率等），提升模型解读一致性。
- 前端：调试信息升级为可折叠面板，完整展示发给模型的参数（model/enableWebSearch/生成的检索 queries/系统或开发者 prompt/用户 prompt）。
- 范围约束：不修改 Top200 列表 AI 解读（Coze + top100_insight）相关指令与链路。

## Impact
- Affected specs: 大盘看板 AI 解读（add-market-board-ai-insight）
- Not affected: Top200 列表 AI 解读（`server/lib/top100Insight.ts` 的 prompt 与调用链保持不变）
- Affected code:
  - `server/routes/ai.ts`（仅 `/market/insight` 分支）
  - `server/lib/aihubmix.ts`（模型调用参数与可观测信息透传，如需要）
  - `server/lib/marketBoardInsightContextV2.ts`（补充指标字典：含义与单位；生成搜索 queries 所需的趋势要素）
  - `src/components/MarketBoardAiInsight.tsx`（调试信息折叠展示与请求参数展示）

## ADDED Requirements
### Requirement: 默认模型为 gpt-4.1-free（仅大盘看板）
系统 SHALL 将大盘看板 AI 解读的默认模型设置为 `doubao-seed-2-0-pro`。

#### Scenario: 默认调用
- **GIVEN** 服务端未显式配置 `AIHUBMIX_MODEL`
- **WHEN** 用户在大盘看板点击生成 AI 解读
- **THEN** 后端使用 `doubao-seed-2-0-pro` 作为基础模型 id（联网时追加 `:surfing`）
- **AND** 不影响 Top200 列表的 AI 解读

### Requirement: 指标驱动的资讯检索与归因
系统 SHALL 在启用联网检索（`enableWebSearch=true`）时，基于指标趋势生成检索 query，并要求模型引用权威来源进行归因总结。

#### Scenario: 联网检索（近 7–14 天）
- **GIVEN** `enableWebSearch=true`
- **WHEN** 用户生成 AI 解读
- **THEN** 后端生成一组检索 queries（例如 3–8 条），其来源必须与当前指标趋势相关（如趋势突破/回撤、波动收敛/扩张、流动性高低与变化、股债利差所处区间）
- **AND** 模型在“近期资讯/关键事件”中必须给出最近 7–14 天内与 A 股大盘相关的要点摘要
- **AND** 每条要点必须附带可追溯 URL
- **AND** 在“归因/总结”部分明确哪些结论来自指标、哪些来自资讯

#### Scenario: 联网但无可靠来源
- **GIVEN** `enableWebSearch=true`
- **WHEN** 模型无法获得足够可靠来源
- **THEN** 输出必须写明“已联网检索但未获得足够可靠来源”
- **AND** 列出尝试过的 2–4 个检索关键词/查询方向

### Requirement: 指标含义与单位传递
系统 SHALL 在发送指标数据给模型时，提供字段字典（含义与单位/口径）。

#### Scenario: 字段字典
- **WHEN** 后端构造模型输入
- **THEN** 模型输入必须包含每个关键字段的：
  - 含义（例如“北向资金：当日净流入，正为流入”）
  - 单位/口径（例如 点、%、万元、分位%、无量纲；股债利差 value 为比率差值）
- **AND** 不改变现有指标计算口径，仅增强语义说明

### Requirement: 可折叠的调试信息面板
系统 SHALL 在前端提供可折叠调试信息，完整展示发给模型的参数与 prompt。

#### Scenario: 默认折叠
- **WHEN** 页面加载
- **THEN** 调试信息默认折叠，不显著占用屏幕

#### Scenario: 展开查看
- **WHEN** 用户展开调试信息
- **THEN** 展示以下内容：
  - enableWebSearch、最终 model（是否带 `:surfing`）
  - 生成的搜索 queries（若 enableWebSearch=true）
  - 系统/开发者 prompt（完整文本）
  - 用户 prompt（完整文本）

## MODIFIED Requirements
### Requirement: 大盘看板 AI 解读输入结构
输入结构从“仅结构化指标数据”扩展为“结构化指标数据 + 指标字段字典 +（可选）指标驱动的检索 query 集合”，以便模型可解释与可追溯。

## REMOVED Requirements
### Requirement: 用户选择解读侧重点/近期窗口
**Reason**: 已由系统固定提供短/中/长线视角输出与 720 天窗口；用户无需额外选择。
**Migration**: 前端移除相关选择控件；后端忽略相关参数（如仍传入）。
