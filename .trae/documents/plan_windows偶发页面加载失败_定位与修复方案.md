# Windows偶发“页面加载失败”定位与修复方案（稳定优先）

## Summary
- 目标：修复 Windows 浏览器偶发出现“页面加载失败（Value is null）”且刷新后恢复的问题。
- 核心思路：先收敛 `src/main.tsx` 启动兜底触发条件，避免被非致命/瞬时异常误触发；再补充最小化诊断信息，定位真实异常来源。
- 成功标准：
  - 正常访问不再偶发落入全屏“页面加载失败”兜底；
  - 真正启动失败时仍能展示兜底页；
  - `npm run lint` 与 `npm run check` 通过。

## Current State Analysis

### 1) 直接触发点已定位
- 文件：`src/main.tsx`
- 现状：
  - 全局监听 `window.error`（capture）与 `window.unhandledrejection`；
  - 命中后立即调用 `showBootFallback(detail)`；
  - 文案固定含 “Safari / iPadOS” 提示；
  - `showBootFallback` 仅通过 `#root.childElementCount > 0` 判断是否已渲染。
- 风险：
  - 在 React 首屏挂载前（或严格模式双渲染窗口），任何非致命异常都可能触发全屏兜底；
  - “Value is null”类瞬时错误可能来自第三方库/浏览器状态，而不等于应用不可用。

### 2) 与用户现象一致性
- “偶发、刷新后消失”说明更像瞬时/竞态问题，不像稳定逻辑错误。
- 全屏提示文案来自 `main.tsx`，与截图完全一致，说明并非业务模块内部错误态，而是全局启动兜底接管了页面。

### 3) 相关联风险点（需联动复核）
- 近期图表联动代码（`LowVolOpportunityChart` / `MarketLiquidityChart`）存在运行期高频事件（crosshair、visible range、setData）；
- 即便业务可恢复，当前全局兜底也可能“放大”为不可用页。

## Proposed Changes

### Phase A：收紧启动兜底触发条件（先止血）
- 文件：`src/main.tsx`
- 做法：
  - 引入“启动阶段门控”：
    - 仅在 `createRoot(...).render(...)` 前后短窗口（如 8-12 秒）允许触发全屏兜底；
    - 一旦应用确认首屏已挂载（可通过 root 标记/微任务确认），后续全局异常不再覆盖整页。
  - 对 `unhandledrejection` 增加“可忽略异常”白名单（继续保留 AbortError；补充常见瞬时/跨域噪声判定）。
  - 对 detail 文本做更稳健序列化，避免对象 reason 序列化异常再次触发错误。
- Why：先解决“可用页面被误判为启动失败”的核心问题。

### Phase B：启动失败兜底文案与场景分流
- 文件：`src/main.tsx`
- 做法：
  - 将兜底文案改为平台中性，不默认指向 Safari/iPadOS；
  - 根据触发来源（error/rejection）显示简短原因码（如 `BOOT_ERR`/`BOOT_REJECT`），便于后续排查；
  - 保留 detail 但增加长度/字符过滤，避免泄露与噪声。
- Why：减少误导，提升可观测性。

### Phase C：补充最小诊断埋点（仅本地可见）
- 文件：`src/main.tsx`（必要时新增轻量 util）
- 做法：
  - 在触发/忽略全局异常时输出结构化 `console.warn`（含事件类型、message、phase、是否触发fallback）；
  - 不引入后端日志链路，不新增外部依赖。
- Why：帮助复现并确认“Value is null”真实来源，不影响线上链路。

### Phase D：图表高频链路复核（不扩展改动）
- 文件：
  - `src/components/charts/LowVolOpportunityChart.tsx`
  - `src/components/charts/MarketLiquidityChart.tsx`
- 做法：
  - 只读复核最近修复后的 crosshair/setData 分支是否仍存在“空值传入第三方 API”的窗口；
  - 仅在发现明确触发路径时做最小保护（参数 guard），避免额外行为变更。
- Why：在不扩大改动面的前提下，降低“Value is null”再次出现概率。

## Assumptions & Decisions
- 决策：优先修复“误触发全屏兜底”这一可用性问题，而不是先做大范围组件重构。
- 决策：保持兜底机制存在，但仅用于真正启动失败。
- 决策：诊断信息以本地 console 为主，避免新增运维依赖。
- 假设：该问题主要发生于启动早期的异常捕获窗口。

## Verification Steps

### 功能验证
- Windows 浏览器冷启动多次（建议 20 次）：
  - 页面应正常进入，不应偶发出现全屏失败页；
  - 若出现非致命异常，仅 console 记录，不覆盖页面。
- 人工制造启动失败（例如临时破坏 `#root` 获取逻辑，测试后恢复）：
  - 兜底页仍能正确显示。

### 回归验证
- 低波/价值/大盘页面基础交互正常（切 tab、图表 hover、开关副图）。
- `npm run lint` 通过。
- `npm run check` 通过。
- 改动文件 diagnostics 无新增错误。

## Out Of Scope
- 不改后端 API、缓存策略、数据口径。
- 不引入远程监控/告警平台。
- 不做图表模块的大规模重构。
