# 计划：RPS 原始/相对视图与时间窗归一化改造

## 1. Summary
- 在现有“市场风格RPS”图表区域引入双视图：
  - **原始视图**：保持当前口径（`rpsRaw` + `rpsMa50`）。
  - **相对视图**：对每个标的按选定起点做归一化（起点=1），并显示 `归一化RPS` + `归一化MA50`。
- 增加统一时间控件（对两种视图都生效）：  
  `最近1周/2周/1个月/3个月(默认)/6个月/1年/2年/3年/5年/年初至今/自定义起点日期`。
- 在相对视图中提供清晰对比基准：新增 `y=1` 参考线，并在文案中明确“515080.SH 为分母基准，归一化后各曲线起点拉齐”。

## 2. Current State Analysis
- `src/components/RpsStylePanel.tsx`
  - 首屏加载后拉取 summary + matrix，并按矩阵 ticker 拉 `fetchRpsStyleSeries`。
  - 当前没有图表视图切换，也没有时间窗控制；图表使用完整历史序列直接渲染。
- `src/components/charts/RpsStyleChart.tsx`
  - 输入仅为 `seriesByTicker`，内部把 `rpsRaw` 与 `rpsMa50`转成两条线。
  - 图例固定文案为“RPS 实线 / MA50 虚线”；无 `y=1` 参考线、无周期裁剪、无归一化逻辑。
- `src/utils/marketApi.ts`
  - 已支持 `fetchRpsStyleSeries({ ticker, startDate, endDate })`，具备后端时间参数能力。
  - 当前前端调用未传入时间范围参数。
- 结论：该需求可完全在前端实现（基于现有 API 数据结构），无需新增后端接口与迁移。

## 3. Proposed Changes

### 3.1 统一时间范围模型（Panel 层）
- 修改文件：`src/components/RpsStylePanel.tsx`
- 新增状态：
  - `chartView: 'raw' | 'relative'`（默认 `relative` 或 `raw` 需按产品决定，当前按你要求“默认最近3个月”，视图默认建议 `relative` 以突出比较）。
  - `rangeKey: '1w' | '2w' | '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | '5y' | 'ytd' | 'custom'`（默认 `3m`）。
  - `customStartDate: string`（仅 `rangeKey='custom'` 时生效）。
- 新增工具函数：
  - 从“今天”计算 `startDate/endDate`。
  - `ytd` 起点取当年 `01-01`。
  - `custom` 起点做合法性约束（不得晚于 `endDate`，不得空）。
- 数据加载调整：
  - 调 `fetchRpsStyleSeries` 时透传 `startDate/endDate`，减少前端裁剪负担和网络负载。
  - 保持 summary/matrix 加载逻辑不变。

### 3.2 图表双视图能力（Chart 层）
- 修改文件：`src/components/charts/RpsStyleChart.tsx`
- `Props` 扩展：
  - `viewMode: 'raw' | 'relative'`
  - `baseLabel?: string`（用于图例/说明，默认 `515080.SH=1`）
- 预处理逻辑拆分：
  - `raw`：维持当前 `rpsRaw/ma50`。
  - `relative`：
    - 找到各 ticker 序列有效起点（第一条有效 `rpsRaw`）。
    - `normalizedRps = rpsRaw / rpsRaw(start)`；`normalizedMa50 = rpsMa50 / rpsRaw(start)`。
    - 起点无法计算时跳过该 ticker 对应点。
- 渲染增强：
  - `relative` 模式下新增 `y=1` 参考线（半透明中性颜色，轴标签隐藏）。
  - 图例文案按模式切换：
    - 原始视图：`RPS 实线 / MA50 虚线`
    - 相对视图：`归一化RPS 实线 / 归一化MA50 虚线（起点=1）`

### 3.3 UI 交互与文案
- 修改文件：`src/components/RpsStylePanel.tsx`
- 在图表上方新增两组控件：
  - 视图切换：`原始视图`、`相对视图`
  - 时间范围：你给定的 11 个选项（含 `自定义起点日期`）
- 当选 `自定义起点日期`：
  - 展示 `<input type="date">`（统一控件区域内）
  - 变更日期后自动触发重载/重算
- 文案补充：
  - 明确“相对视图：各标的在所选起点归一化为 1，便于横向比较涨跌幅与斜率变化；分母基准为 515080.SH”。

### 3.4 类型与数据结构
- 修改文件：`src/utils/marketApi.ts`（若需要）
- 保持现有 `RpsStyleSeriesPoint` 即可，不新增后端字段。
- 可新增前端本地类型：
  - `RpsViewMode`
  - `RpsRangeKey`
  - `ResolvedDateRange`

## 4. Assumptions & Decisions
- 已确认：相对视图展示 **归一化RPS + 归一化MA50**。
- 已确认：时间范围控件做 **全局统一**（原始/相对共用）。
- 已确认：时间范围默认 `最近3个月`。
- 口径约束：
  - 分母基准固定为 `515080.SH`（策略口径不变）。
  - 相对视图归一化仅改变显示尺度，不改变底层 RPS 定义与矩阵评分逻辑。

## 5. Verification Steps
- 交互验证：
  - 切换 `原始/相对` 视图，图例文案与曲线尺度明显变化。
  - 各预设周期切换后，数据范围随之收敛/放大。
  - `自定义起点日期` 输入合法日期可刷新，非法输入有保护。
- 数值验证：
  - 相对视图下各 ticker 的首个有效点应接近 `1.0000`。
  - `y=1` 参考线可见，便于观察强弱分化。
  - 原始视图数值与当前版本一致（无回归）。
- 稳定性验证：
  - 快速切换时间范围不会引发异常闪烁/报错。
  - 保持 `DataStatusBanner`、matrix、summary 行为不变。
- 工程验证：
  - `npm run build` 通过。
  - 最近编辑文件 `GetDiagnostics` 无新增错误。
