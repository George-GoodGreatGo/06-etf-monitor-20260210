# 低波机会：利差平滑与10年滚动分位 Spec

## Why
当前「股息收益率(3Y年化)-10Y利差」存在季节性与结构性尖峰，影响“性价比长期信号”的可读性与可用性。机构实践中通常采用“平滑后的利差用于趋势/触发 + raw利差用于滚动长窗分位”的组合，以减少误判并保持历史可比性。

## What Changes
- 在后端低波指数 API 中新增利差平滑序列（用于展示与触发），平滑基于 raw 利差。
- 将利差分位数从现有 3 年滚动分位升级为 **10 年滚动分位**，且分位计算 **基于 raw 利差**（不使用平滑值）。
- 在前端图表中新增/调整视图：
  - “利差（平滑）”展示平滑后的利差序列（单位：百分点）
  - “利差分位(10年)”展示 10 年滚动分位（0-100）
- 在 UI/tooltip 中明确口径：平滑仅用于展示/触发；分位用于稀缺性判断且基于 raw。

## Impact
- Affected specs: 低波指数机会识别（利差与分位口径）
- Affected code:
  - 后端：`server/lib/lowVol.ts`、`server/routes/lowVol.ts`
  - 前端：`src/components/LowVolOpportunityPanel.tsx`、`src/components/charts/LowVolH30269Chart.tsx`、`src/utils/marketApi.ts`

## ADDED Requirements
### Requirement: 股息收益率观测窗口（机构默认）
系统 SHALL 将“股息收益率”（由 PRI/TRI 推算的分红贡献年化）默认定义为 **滚动 1 年（TTM）** 口径，而非更长的 3 年或更短的单期年化。

#### Definition
- 交易日近似：`lookbackDays = 252`
- `DividendReturn(1Y) = (TRI_t/TRI_{t-252}) / (PRI_t/PRI_{t-252}) - 1`
- `dividendYieldPct = DividendReturn(1Y) * 100`

#### Rationale（为什么选 1Y）
- 机构常用“TTM/过去12个月股息率”作为权益现金回报的基础口径，便于解释与跨周期可比。
- 1Y 能较快反映分红制度变化；季节性尖峰由“利差平滑 + 长窗分位”解决，而不是通过无限加长股息窗口来牺牲响应速度。

### Requirement: 利差平滑序列
系统 SHALL 基于 raw 利差序列生成平滑利差序列，用于更稳定的趋势展示与触发判断。

#### Definition
- `spreadRawPct = dividendYieldPct - yield10yPct`（单位：百分点）
- `spreadSmoothPct`：对 `spreadRawPct` 做平滑得到（单位：百分点）

#### Smoothing Policy（机构风默认）
系统 SHALL 采用 **EWMA** 作为默认平滑方法，参数使用“半衰期”表达，默认值为 **6 个月**。
- 交易日近似：`halfLifeDays = 126`
- 更新公式：`s_t = α*x_t + (1-α)*s_{t-1}`，其中 `α = 1 - exp(ln(0.5)/halfLifeDays)`

#### Missing Data Rules
- **WHEN** `spreadRawPct` 缺失（股息收益率或10Y缺失）
- **THEN** `spreadSmoothPct` 当日输出 `null`，且不推进平滑状态（避免用缺失日污染平滑序列）

### Requirement: 10年滚动分位（基于 raw）
系统 SHALL 输出 `spreadPctRank10y`，表示 raw 利差在过去 10 年窗口内的滚动分位数（0-100）。

#### Definition
- 10 年窗口按交易日近似：`windowDays = 2520`
- `spreadPctRank10y` 计算对象为 `spreadRawPct`（不使用 `spreadSmoothPct`）

#### Minimum Samples
- 系统 SHALL 在窗口内可用样本不足 `minPeriods=252` 时返回 `null`（避免小样本分位不稳定）

## MODIFIED Requirements
### Requirement: 低波 API 输出字段
系统 SHALL 在 `GET /api/lowvol/h30269` 的 `data.series[]` 中新增字段：
- `spreadRawPct`：raw 利差（百分点）
- `spreadSmoothPct`：平滑利差（百分点）
- `spreadPctRank10y`：raw 利差 10 年滚动分位（0-100）

并保持现有字段兼容（如 `spreadPctRank3y` 允许保留但前端默认展示 10 年版本）。
