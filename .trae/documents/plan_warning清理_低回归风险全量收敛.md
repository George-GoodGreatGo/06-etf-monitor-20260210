# Warning清理（低回归风险全量收敛）计划

## Summary
- 目标：在不影响稳定性的前提下，将当前 ESLint warning（`react-hooks/exhaustive-deps`）清理至 0。
- 范围：仅处理已定位的 4 个前端文件 warning，不触碰后端与业务口径逻辑。
- 策略：先“行为等价”的 ref cleanup 收敛，再处理依赖数组；优先 `useCallback + 局部快照变量`，避免功能重构。
- 约束：不引入 `eslint-disable` 作为常规方案；若某处修复可能改变行为，采用更保守的“提取稳定回调 + 最小依赖”方式。

## Current State Analysis

### 1) warning 分布（已定位）
- `src/components/LowVolOpportunityPanel.tsx`
  - `useEffect` 缺少依赖：`run`
- `src/components/ValueTimingPanel.tsx`
  - `useEffect` 缺少依赖：`run`
- `src/components/charts/LowVolOpportunityChart.tsx`
  - `useMemo` 缺少依赖：`hover`
  - 多个 `useEffect` cleanup 中引用 `chartsRef.current / seriesRef.current`
  - 多个 `useEffect` 缺少依赖：`updateSpreadPctZones`
- `src/components/charts/MarketLiquidityChart.tsx`
  - 多个 `useEffect` cleanup 中引用 `chartsRef.current / seriesRef.current / hsSegRef.current`
  - 多个 `useEffect` 缺少依赖：`updateV5ZoneBg / updateV5PctZoneBg`、以及若干 pane 显示状态

### 2) 风险判断
- ref cleanup warning 本质是闭包捕获时机问题，修复为“effect 内局部快照变量”基本不影响行为，优先级最高。
- 缺少依赖 warning 若直接“机械补齐”，可能触发额外重渲染/重订阅；需配套 `useCallback` 稳定函数引用，控制副作用触发频率。
- 面板 `run` 逻辑属于请求副作用，需避免重复请求与竞态；应将 `run` 包装为稳定回调并保持现有取消/超时机制不变。

## Proposed Changes

### Phase A：先清 ref cleanup warning（最低回归风险）
- 文件：
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - `src/components/charts/MarketLiquidityChart.tsx`
- 做法：
  - 在各 chart 初始化 `useEffect` 中，把 `chart`、`series`、必要的 ref 目标保存为局部常量（snapshot），cleanup 仅操作 snapshot。
  - 避免 cleanup 内读取 `*.current` 的“动态值”，消除 lint 告警并保持卸载语义。
- 预期收益：不改渲染逻辑，不改数据逻辑，几乎零行为变化。

### Phase B：稳定回调并补齐依赖（图表文件）
- 文件：
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - `src/components/charts/MarketLiquidityChart.tsx`
- 做法：
  - 将 `updateSpreadPctZones`、`updateV5ZoneBg`、`updateV5PctZoneBg` 改为 `useCallback`。
  - 回调依赖仅保留必要状态（阈值、面板显隐、DOM refs 的稳定引用）。
  - 对使用这些回调的 `useEffect` 补齐依赖数组，保持订阅/解绑严格对称。
  - 对 `useMemo` 的 `hover` 依赖告警，改为显式依赖完整输入（或移除不必要的细粒度字段拆分，统一由 `hover` 驱动）。
- 稳定性控制：
  - 不改 chart 配置项与数据源；
  - 不改 crosshair / visible range 同步规则，仅稳定函数身份与 effect 依赖。

### Phase C：面板 `run` 依赖收敛（请求副作用）
- 文件：
  - `src/components/LowVolOpportunityPanel.tsx`
  - `src/components/ValueTimingPanel.tsx`
- 做法：
  - 将 `run` 改为 `useCallback`（依赖 `indexCode` 等必要参数）。
  - `useEffect` 依赖数组由 `[indexCode]` 改为 `[run]`，消除 warning 且保持触发时机等价。
  - 保留现有 AbortController + timeout 清理流程，避免重复请求泄漏。

### Phase D：全量回归与结果确认
- 执行顺序：
  - 每完成一个 Phase 执行 `npm run lint`，确认 warning 递减；
  - 全部完成后执行 `npm run check` 与最终 `npm run lint`。
- 验收标准：
  - `npm run lint` 输出 `0 errors, 0 warnings`；
  - `npm run check` 通过；
  - 页面关键交互不退化：切换 pane、hover 联动、缩放同步、tab 切换拉数行为正常。

## Assumptions & Decisions
- 决策：以“修复 warning 且不引入行为漂移”为优先，不做可见功能增强。
- 决策：不采用 `eslint-disable` 压制规则，除非遇到框架限制且会在计划内单独标注。
- 决策：依赖项补齐必须和函数稳定化一起进行，避免副作用风暴。
- 假设：当前图表与面板交互已有可复现人工路径，可用于快速冒烟验证。

## Verification Steps
- 静态验证：
  - `npm run lint`：目标 0 warning。
  - `npm run check`：保持通过。
- 功能冒烟：
  - 低波机会页：切换 `BIAS` 基准、开关副图、hover 提示联动。
  - 大盘看板页：主图与副图同步滚动、crosshair 联动、背景分区更新。
  - 价值择时页：切指数后仅触发一次有效请求（旧请求正确 abort）。
- 回归判定：
  - 若出现图表订阅重复或交互抖动，优先回退该 effect 的依赖修复并改为更细颗粒 callback 拆分后再前进。

## Out Of Scope
- 不调整后端逻辑、缓存策略、数据口径。
- 不进行 UI 样式改版或图表交互新增能力。
- 不改 ESLint 规则级别与配置。
