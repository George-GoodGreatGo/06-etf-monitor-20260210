# 低波/价值副图重开数据缺失与联动失效修复计划（稳定优先）

## Summary
- 目标：修复【低波机会】【价值择时】中副图关闭再开启后出现的数据缺失、光标联动失效、TIPS不更新问题。
- 参考基线：对齐【大盘看板】当前稳定的“联动订阅 + 数据回灌 + 可见性切换”模式。
- 成功标准：
  - 副图任意开关顺序下，曲线稳定显示；
  - 主图/副图光标与日期联动正常；
  - TIPS 持续更新，不出现“卡死”；
  - lint/check 继续通过且无新增诊断错误。

## Current State Analysis

### 1) 问题主链路定位（低波/价值共用）
- 文件：
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - `src/components/charts/ValueTimingChart.tsx`
- 现状差异（相对大盘）：
  - `LowVolOpportunityChart` 在 `setData` 后对 `bias/biasPct/spread/spreadPct` 直接调用 `applyOptions`，未做实例存在性保护；
  - crosshair 同步逻辑中 `syncingRef` 使用“手动置 true/false”，未用 `try/finally`，若第三方 API 抛错会遗留 `syncingRef=true`，后续 hover/TIPS 被永久短路；
  - 副图开关通过高度/透明切换，联动 effect 依赖多状态重绑，若某次重绑窗口出现异常，可能导致“某一图可响应，其他图失联”。

### 2) 与用户现象的对应关系
- “副图重开无数据，再切一次恢复”：
  - 高概率由可见性切换期的时序问题 + 未保护调用导致某轮 setData/同步中断。
- “光标只在单图有效、TIPS不再变化”：
  - 与 `syncingRef` 在异常时未恢复（卡 true）高度吻合；此时 `onCrosshair` 入口会一直 `return`。

### 3) 大盘看板可借鉴点
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 可复用模式：
  - 联动/重绘路径统一通过 ref 回调中转；
  - 数据设置与可见范围同步均有实例存在判断；
  - 副图显示状态变化后显式重放可见范围与区域更新。

## Proposed Changes

### Phase A：补齐低波图表实例保护（防止副图重开首轮空白）
- 文件：`src/components/charts/LowVolOpportunityChart.tsx`
- 做法：
  - 对 `applyOptions`、`timeScale().setVisibleLogicalRange` 等副图对象调用增加空值判断（对齐大盘风格）；
  - 将副图开关后的数据回灌保持幂等：关闭写空，开启立即按当前 `data` 回灌，并确保不会被后续空对象调用中断。
- Why：先消除“重开偶发无数据”的直接风险。

### Phase B：重构 crosshair 同步临界区（防止联动/TIPS卡死）
- 文件：`src/components/charts/LowVolOpportunityChart.tsx`
- 做法：
  - 将 `syncingRef` 的临界区改为 `try/finally`，确保任何异常都能回落为 `false`；
  - 对 `setCrosshairPosition` 增加更严格前置条件（目标 series 存在、值为 finite、图表在当前联动集合内）；
  - 在副图集合变化（show/hide）时显式执行一次“clear + 重新同步”以避免 stale 订阅状态。
- Why：修复“只剩单图响应、TIPS不更新”的根因路径。

### Phase C：价值择时映射链路对齐验证（避免放大同源问题）
- 文件：`src/components/charts/ValueTimingChart.tsx`
- 做法：
  - 校验映射字段 `bias/biasPct/spread/spreadPct` 与低波图表消费字段一一对应；
  - 对边界空值做最小防御（仅类型与空值兜底），不改指标语义。
- Why：价值择时复用低波图表，需确保输入稳定。

### Phase D：对照大盘复核同类临界区（仅必要最小修补）
- 文件：`src/components/charts/MarketLiquidityChart.tsx`
- 做法：
  - 只读复核 `syncingRef` 临界区是否同样需要 `try/finally` 防护；
  - 若存在同类隐患，做同级别最小修补，保持行为一致。
- Why：满足“参考大盘正常逻辑”同时避免未来再现同类故障。

## Assumptions & Decisions
- 决策：优先在共用组件 `LowVolOpportunityChart` 做根因修复，保证低波与价值同时受益。
- 决策：不更改 UI 交互定义，仅修复同步时序与异常保护。
- 决策：以“大盘当前稳定模式”为对照，不引入新交互行为。
- 假设：当前复现路径主要触发于副图可见性切换后首轮联动。

## Verification Steps

### 功能验证（核心）
- 低波机会：
  - 连续执行：关/开 `BIAS`、`BIAS分位`、`利差(平滑)`、`利差分位` 各 2 轮；
  - 每轮确认：副图曲线可见、主副图光标联动、TIPS日期与数值持续变化。
- 价值择时：
  - 同样开关流程；
  - 切换 `BIAS基准(SMA250/SMA60)` 后再次执行一轮。
- 大盘看板（复核）：
  - 开关副图后联动与 hover 保持正常。

### 静态验证
- `npm run lint` 通过（0 error/0 warning）。
- `npm run check` 通过。
- 改动文件 diagnostics 无新增错误。

## Out Of Scope
- 不改后端接口、缓存策略、数据口径。
- 不新增图表功能，仅修复稳定性缺陷。
