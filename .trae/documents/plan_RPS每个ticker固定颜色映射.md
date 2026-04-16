# 计划：RPS每个Ticker固定颜色映射

## 1. Summary
- 目标：为 `RPS` 模块中每个 ticker 提供固定颜色，避免因渲染顺序/开关变化导致颜色漂移，提升阅读识别体验。
- 范围：仅修改前端图表颜色分配逻辑（`src/components/charts/RpsStyleChart.tsx`），不改接口与后端数据。
- 预期：同一 ticker 在 `raw`、`relative`、`score` 三个视图及图例/hover 中始终保持同一颜色。

## 2. Current State Analysis
- 文件：`src/components/charts/RpsStyleChart.tsx`
  - 当前用 `COLORS[idx % COLORS.length]` 按索引分配颜色。
  - 索引来自 `Object.keys(seriesByTicker).sort()` 后的数组位置，属于“顺序驱动”，不是“ticker显式绑定颜色”。
  - 当 ticker 集合发生增减、排序变化或未来扩展时，颜色可能与用户心智映射不一致。
- 文件：`src/components/RpsStylePanel.tsx`
  - ticker 来源为矩阵数据（缺省回退 `DEFAULT_TICKERS`），并支持动态显隐 `enabledTickers`。
  - 图表组件通过 `seriesByTicker + enabledTickers` 渲染，因此颜色稳定性应在图表层实现，不依赖上层顺序。

## 3. Proposed Changes

### 3.1 新增显式固定色映射
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动内容：
  - 将现有 `COLORS` 索引方案升级为 `TICKER_COLOR_MAP` 常量映射（key 为 ticker，value 为色值）。
  - 覆盖当前 RPS 已使用的核心 ticker（如 `159915.SZ`、`588000.SH`、`513180.SH`、`510300.SH`；必要时补充 `512890.SH` 作为扩展预留）。
  - 颜色值优先沿用当前配色体系，减少视觉突变。

### 3.2 增加未知ticker兜底策略
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 改动内容：
  - 提供 `getTickerColor(ticker)`：
    - 命中 `TICKER_COLOR_MAP` 时返回固定色；
    - 未命中时从 `COLORS` 调色盘按稳定规则计算（例如基于 ticker 字符串哈希取模），保证同一未知ticker跨会话仍稳定。
  - 在 `prepared.lines` 构建时改用 `getTickerColor(ticker)`，不再依赖 `idx` 分配。

### 3.3 颜色一致性回归点
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- 保持不变：
  - 图例圆点颜色、RPS实线颜色、MA50虚线颜色继续共用同一 `item.color`。
  - hover 文本与阈值背景带逻辑不改。
- 目的：
  - 仅修复“颜色身份稳定性”，避免影响其它交互与分析逻辑。

## 4. Assumptions & Decisions
- “固定颜色”定义：颜色由 ticker 本身决定，不受数组顺序、视图切换、启停指标等影响。
- 若用户后续想指定“品牌色/语义色”，可在 `TICKER_COLOR_MAP` 上直接覆写；本次先保证稳定性优先。
- 兜底哈希仅用于未来新增 ticker，不改变当前已映射 ticker 的颜色表现。

## 5. Verification Steps
- 功能验证：
  - 在 `raw/relative/score` 三个视图切换，同一 ticker 颜色不变。
  - 开关任意 ticker（`enabledTickers`）后再开启，颜色保持不变。
  - 页面刷新后同一 ticker 颜色保持不变。
- 回归验证：
  - 图例颜色与对应折线颜色一致。
  - `MA50` 虚线仍与对应 ticker 主线同色（仅线型不同）。
- 工程验证：
  - `npm run build` 通过。
  - `RpsStyleChart.tsx` 无新增诊断错误。
