# 计划：价值择时卡片文案与国证价值100PE来源说明更新

## 1. Summary
- 目标：
  - 将卡片上的“分位”字段文案改为“股债利差分位”。
  - 更新卡片与图表中的指数介绍文案，突出指数构建特点。
  - 对“国证价值100（980081）”补充动态 PE 数据来源说明：历史来自 `touzid`（截至 `2026/4/13`），增量来自国证指数官网每日抓取。
- 范围：仅文案与展示说明更新，不改计算逻辑与数据结构。

## 2. Current State Analysis
- 卡片“分位”文案落点：
  - `src/pages/Home.tsx` 价值择时卡片右上角使用文案 `分位 {last.spreadPctRank5y...}`。
- 卡片指数介绍文案落点：
  - `src/pages/Home.tsx` 的 `VALUE_INDEX_OPTIONS` 中 `desc` 为各指数简介。
- 价值择时页说明文案落点：
  - `src/components/ValueTimingPanel.tsx`：
    - 顶部介绍区使用 `indexDesc`；
    - 指标说明中含“利差（核心）”“利差分位(5年)”；
    - 右侧小卡包含“利差分位(5年)”字段。
    - 现有 980081 提示为“ETF 替代口径（159263）”。
- 图表说明文案落点（价值择时复用低波图组件）：
  - `src/components/charts/ValueTimingChart.tsx` 复用 `LowVolOpportunityChart(metricMode='earnings')`。
  - `src/components/charts/LowVolOpportunityChart.tsx` 的 `showInfo` 区包含“指标定义/建议规则”，但未展示具体指数构建与 980081 的 PE 来源说明。

## 3. Proposed Changes

### A. 卡片字段文案：`分位` -> `股债利差分位`
- 文件：`src/pages/Home.tsx`
- 变更：
  - 价值择时卡片右上角标签文案由 `分位` 改为 `股债利差分位`（保留数值与格式不变）。
- 原因：
  - 文案语义更完整，避免“分位”对象不明确。

### B. 卡片指数介绍文案升级（突出构建特点）
- 文件：`src/pages/Home.tsx`
- 变更：
  - 更新 `VALUE_INDEX_OPTIONS` 三个指数的 `desc`，突出“构建因子/风格特征/评估用途”：
    - `932365`：强调“自由现金流质量与可持续性”；
    - `932315`：强调“红利 + 质量筛选”；
    - `980081`：强调“价值风格宽基 + PE 数据来源口径说明（touzid 历史 + 国证官网增量）”。
- 原因：
  - 提升卡片认知效率，与后续图表说明保持一致。

### C. 价值择时面板文案同步更新
- 文件：`src/components/ValueTimingPanel.tsx`
- 变更：
  - 顶部说明段落补充/强化指数构建特点（沿用并增强 `indexDesc`）。
  - 将右侧小卡“利差分位(5年)”字段名改为“股债利差分位(5年)”。
  - 指标说明里的“利差（核心）/利差分位(5年)”文案同步统一为“股债利差”语义。
  - 对 `indexCode==='980081'` 添加专门来源说明标签：
    - “动态PE：历史数据来自 touzid（截至2026/4/13），增量数据来自国证指数官网每日抓取。”
  - 保留已有快照/非交易日提示，不改行为逻辑。
- 原因：
  - 主面板文案与卡片、图表说明一致，形成统一口径。

### D. 图表说明区同步指数介绍与 980081 特殊说明
- 文件：`src/components/charts/ValueTimingChart.tsx`
- 变更：
  - 为图表组件传递 `indexLabel/indexCode/indexDesc`（新增或扩展 props 透传）。
- 文件：`src/components/charts/LowVolOpportunityChart.tsx`
- 变更：
  - 在 `metricMode='earnings'` 且存在 `indexDesc` 时，于 `showInfo` 区新增“指数介绍”行，显示构建特点文案。
  - 当 `metricMode='earnings' && indexCode==='980081'` 时，新增“动态PE来源说明”行：
    - “历史数据来自 touzid（截至2026/4/13），增量数据来自国证指数官网每日抓取。”
  - 不改变图表绘制和信号规则，仅新增说明文本。
- 原因：
  - 满足“同步更新图表上的指数介绍内容”与 980081 特殊说明要求。

## 4. Assumptions & Decisions
- 决策：
  - 本次仅做展示文案与提示增强，不改 API 字段、计算公式与阈值逻辑。
  - “分位”统一改写为“股债利差分位”仅在价值择时相关卡片/面板/图表说明中生效，不影响低波机会模块。
- 假设：
  - 用户给出的 980081 动态 PE 来源说明为最终对外口径，可直接用于 UI 文案。
  - “截至2026/4/13”使用固定文本展示，不做程序化日期推导。

## 5. Verification Steps
- 静态检查：
  - 运行 `npm run check`，确保类型与编译通过。
- 文案落点核验：
  - `Home` 价值卡片展示“股债利差分位”。
  - `VALUE_INDEX_OPTIONS` 的三个指数 `desc` 均更新并突出构建特点。
  - `ValueTimingPanel` 右侧指标卡字段名改为“股债利差分位(5年)”。
  - `ValueTimingPanel` 与图表说明区可见 980081 动态 PE 来源说明（仅 980081 显示）。
- 行为回归：
  - 图表绘制、建议信号与数据加载行为不变；仅 UI 文案变化。
