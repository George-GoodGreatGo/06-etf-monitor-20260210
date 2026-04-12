# 低波机会：新增 300/500/800 红利低波指数 Spec

## Why
当前“低波机会”仅覆盖少量红利/现金流相关指数。补充 300/500/800 红利低波系列，有助于横向比较不同宽基口径下红利低波的性价比与择时信号。

## What Changes
- 在“低波机会”tab 的指数选择处新增 3 支指数：
  - 沪深300红利低波动指数：`930740.CSI`，TRI：`H20740`，简称：`300 红利低波`
  - 中证500红利低波动指数：`931847.CSI`，TRI：`931847CNY010`，简称：`500 红利低波`
  - 中证800红利低波动指数：`931848.CSI`，TRI：`931848CNY010`，简称：`800 红利低波`
- 前端卡片展示：在指数卡片上展示简称、指数代码，并提供不超过 100 字的“编制原则简介”；指数页面顶部介绍第一段与卡片简介保持一致。
- 服务端数据接入：为新增指数补齐 PRI/TRI 拉取与指标计算（股息率、核心利差、利差分位、BIAS 与分位等），与现有低波机会口径保持一致。
- **兼容性**：允许“展示用指数代码”包含 `.CSI` 后缀，但 PRI 拉取使用数值部分（例如 `930740`）以适配 csindex 的 `index-perf` 接口（如需）。

## Impact
- Affected specs: 低波机会指数覆盖范围扩展；新增指数与现有指数同口径可比
- Affected code:
  - `src/pages/Home.tsx`：低波指数卡片列表新增选项与简介
  - `src/components/LowVolOpportunityPanel.tsx`：接收并展示 indexDesc（已存在则对齐即可）
  - `server/lib/lowVol.ts`：LOWVOL_INDEXES 配置扩展；必要时做 PRI code 归一化
  - （可能）`src/utils/lowVolSignal.ts`：如对特定 indexCode 有特殊规则，需要补充/确认不受影响

## ADDED Requirements
### Requirement: 新增指数可选择并可加载
系统 SHALL 在“低波机会”tab 的指数选择处新增 3 个卡片选项，并在点击后加载对应指数数据与图表。

#### Scenario: 成功加载
- **WHEN** 用户在“低波机会”中切换到 `930740.CSI` / `931847.CSI` / `931848.CSI`
- **THEN** 前端请求对应 `GET /api/lowvol/index/:code` 成功返回
- **AND** 图表与指标区正常渲染（在满足必要回溯窗口后逐步出现有效数值）

### Requirement: 简介一致性
系统 SHALL 保证“指数卡片上的编制原则简介”与“指数页面顶部介绍第一段”完全一致（同一数据源）。

#### Scenario: 文案一致
- **WHEN** 用户切换任一新增指数
- **THEN** 卡片展示的简介与面板顶部第一段介绍一致

### Requirement: PRI/TRI 口径一致
系统 SHALL 对新增指数使用与现有低波机会一致的指标口径：
- PRI/TRI 推算过去 252 交易日分红点数与股息率
- 核心利差 = 股息收益率(修正) - 10Y
- 10 年滚动分位（window≈2520，minPeriods≈252）
- BIAS：支持 SMA250（默认）与 SMA60 切换，并提供 3 年分位

#### Scenario: 指标字段齐全
- **WHEN** 请求 `GET /api/lowvol/index/:code`
- **THEN** `data.series` 中包含并填充（在满足窗口后）：`dividendYieldPct/spreadRawPct/spreadSmoothPct/spreadPct/spreadPctRank10y/biasPct3y/biasPct3y60` 等字段

### Requirement: 失败时显式报错
系统 SHALL 在 TRI 数据为空/不足/无法对齐时返回明确错误，以触发前端错误态展示。

#### Scenario: TRI 不可用
- **WHEN** TRI 拉取失败或返回空数组，或 PRI/TRI 重叠样本不足（例如 < 253）
- **THEN** API 返回失败响应并携带可读 `message`（例如“TRI 数据不足或无法对齐，无法计算股息率/利差：930740.CSI”）

## MODIFIED Requirements
### Requirement: 低波支持指数集合
系统 SHALL 将低波机会的支持指数集合扩展为包含上述 3 支指数，并保持现有指数行为不变。

## REMOVED Requirements
无

