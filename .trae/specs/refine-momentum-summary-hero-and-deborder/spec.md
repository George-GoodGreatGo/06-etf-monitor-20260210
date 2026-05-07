# 动量分析页摘要卡片重构 + 全局去边框化 Spec

## Why
当前动量分析页（`/market/rps/custom-query`）存在 10 张等权重的摘要卡片，视觉权重完全等同，导致核心决策指标（Score）与辅助信息（标的名、基准分母、截止日）混在同一层级。同时全局使用大量 `border border-white/10` 和 `border border-[#1E293B]` 硬边框，在深色背景下形成「牢笼感」，视觉噪音过高。需要重构摘要卡片为「主指标突出 + 辅助内联」层级布局，并全局用阴影 + 背景色差替代硬边框。

## What Changes
- **方案1**：将 `customQuerySection` 中 10 张等权 `SUMMARY_CARD_CLS` 卡片合并为 1 个统一的 Hero 容器
  - Score 指标放大到 `text-2xl`，成为视觉焦点
  - RPS + MA50 为中等字号，与 Score 同行展示
  - 交易额系列指标（交易额、昨变%、7日变%、Z值、放量倍数）内联到下方辅助行
  - 标的名+代码+基准分母+截止日信息合并到 Hero 容器标题行
- **方案2**：全局去除不必要的硬边框
  - 标题横幅（`customQueryIntro`）：去掉 `border`，改用 `shadow-md`
  - 摘要 Hero 容器：去掉外层 `border`，卡片间用 `gap` + 背景色差分隔
  - 策略选择区（关键图表指标 section）：去掉 `border`，改用 `bg` 背景差
  - 成交额追踪 section：去外层 `border`，保留内层表格分割线
- 搭建 `mock/momentum-analysis.html` 本地 Mock 页面用于纯视觉回归验证（不依赖后端 API）

## Impact
- Affected specs: `refine-market-rps-custom-query-visual-polish`（配色相关，不冲突）、`optimize-market-rps-custom-query-summary-layout`（布局相关，本 Spec 在其基础上进一步优化）
- Affected code: `src/components/RpsStylePanel.tsx`（仅修改 `customQuerySection` 内部的 JSX 结构和 Tailwind 类名）
- **BREAKING**: 无，不改变任何 API 调用、状态管理、图表组件逻辑

## MODIFIED Requirements

### Requirement: 摘要卡片重构为 Hero 主指标布局
系统 SHALL 将动量分析页 `customQuerySection` 中的 10 张独立等权卡片合并为 1 个统一的 Hero 指标容器，突出 Score 核心决策指标，辅助信息以内联行方式展示。

#### Scenario: 用户查询成功，看到 Hero 摘要
- **WHEN** 用户输入 ETF 代码并成功返回数据
- **THEN** 「查询结果摘要」区域显示 1 个 Hero 容器而非 10 张独立卡片
- **THEN** Score 指标使用 `text-2xl` 字号并带有颜色语义（绿/红/灰），成为视觉第一落点
- **THEN** RPS 和 MA50 指标与 Score 同行或紧邻展示，使用中等字号
- **THEN** 当前标的、基准分母、统一截止日信息合并到 Hero 标题行
- **THEN** 交易额、昨变%、7日变%、Z值、放量倍数以内联辅助行展示，使用 `text-xs`

#### Scenario: 用户查询失败，不显示 Hero
- **WHEN** 查询失败（`customQueryError` 非空）或数据为空（`customQueryLatest` 为 null）
- **THEN** 不渲染 Hero 容器
- **THEN** 维持现有 `DataStatusBanner` 错误展示逻辑不变

### Requirement: 全局去边框化——用阴影和背景色差替代硬边框
系统 SHALL 在动量分析页的 `customQuerySection` 中移除不必要的硬边框（`border`），改用阴影（`shadow`）和背景色差（`bg` 变化）来区分区块。

#### Scenario: 标题横幅无硬边框
- **WHEN** 页面渲染 `customQueryIntro`
- **THEN** 不再使用 `border border-[#1E293B]`
- **THEN** 改用 `shadow-md` + 保持 `bg-[#0F172A]`

#### Scenario: 摘要 Hero 容器无硬边框
- **WHEN** 页面渲染查询结果 Hero 容器
- **THEN** 不使用 `border border-white/10`
- **THEN** 内部子区域用 `gap` 间距 + 微妙背景色差区分

#### Scenario: 策略选择区无硬边框
- **WHEN** 页面渲染「关键图表指标」策略选择区
- **THEN** 外层 section 不使用 `border border-[rgba(248,250,252,0.08)]`
- **THEN** 改用 `bg-[rgba(11,18,32,0.82)]` 与页面底色形成微差

#### Scenario: 成交额追踪区去外层边框
- **WHEN** 页面渲染「最近250个交易日成交额追踪」section
- **THEN** 外层 `section` 不使用 `border border-[#1E293B]`
- **THEN** 内层表格保留行分割线 `border-t` 不动

## ADDED Requirements

### Requirement: Mock 页面搭建
系统 SHALL 提供一个独立的 `mock/momentum-analysis.html` 页面，内嵌模拟数据渲染 Hero 摘要 + 去边框化后的 UI，不依赖任何后端 API，仅用于视觉回归验证。

#### Scenario: Mock 页面正常渲染
- **WHEN** 在浏览器中直接打开 `mock/momentum-analysis.html`
- **THEN** 页面展示与线上动量分析页「查询成功后」一致的 Hero 摘要 + 策略选择 + 图表占位 + 成交额表格
- **THEN** 所有组件使用内联模拟数据，不发起网络请求
- **THEN** 配色、间距、阴影方案与线上一致

#### Scenario: Mock 页面可对比旧版
- **WHEN** 用户滚动 Mock 页面
- **THEN** 可见「旧版对比」区域展示 10 张等权卡片 + 硬边框的原版风格
- **THEN** 对比区域使用半透明遮罩标注「旧版风格」
