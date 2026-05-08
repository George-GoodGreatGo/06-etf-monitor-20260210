# 低波机会：新增"A500红利低波"指数 Spec

## Why
当前"低波机会"已覆盖红利低波、红利质量、自由现金流、银行、国证价值等多只指数，但缺少"A500红利低波"（932422）这一重要的中证A500红利低波主题指数，补充后可更全面地比较不同红利低波策略在低波框架下的性价比与择时信号。

## What Changes
- 在"低波机会"tab 的指数选择处新增 1 支指数：
  - A500红利低波指数：`932422`，PRI：`932422`，TRI：`932422CNY010`，简称：`A500红利低波`
- 前端卡片展示：在指数卡片上展示简称、指数代码，并提供不超过 100 字的编制简介
- 服务端数据接入：补齐 PRI/TRI 拉取与指标计算（股息率、核心利差、利差分位、BIAS 与分位等），与现有低波机会口径保持一致
- 数据源为 csindex（中证指数），与现有大部分指数一致

## Impact
- Affected specs: 低波机会指数覆盖范围扩展；新增指数与现有指数同口径可比
- Affected code:
  - `src/pages/Home.tsx`：`LOWVOL_INDEX_OPTIONS` 数组新增一条
  - `server/lib/lowVol.ts`：`LOWVOL_INDEXES` 配置新增一条
  - 无需修改 `LowVolOpportunityPanel.tsx`、`routes/lowVol.ts`、`marketApi.ts`——均为 code 驱动的通用组件

## ADDED Requirements
### Requirement: 新增指数可选择并可加载
系统 SHALL 在"低波机会"tab 的指数选择处新增 1 个卡片选项（932422 A500红利低波），并在点击后加载对应指数数据与图表。

#### Scenario: 成功加载
- **WHEN** 用户在"低波机会"中切换到 `932422`
- **THEN** 前端请求 `GET /api/lowvol/index/932422` 成功返回
- **AND** 图表与指标区正常渲染（在满足必要回溯窗口后逐步出现有效数值）

### Requirement: 指标字段齐全
系统 SHALL 对 932422 使用与现有低波机会一致的指标口径：
- PRI/TRI 推算过去 252 交易日分红点数与股息率
- 核心利差 = 股息收益率(修正) - 10Y
- 5 年滚动分位（window≈1260，minPeriods≈252）
- BIAS：支持 SMA250（默认）与 SMA60 切换，并提供 3 年分位

#### Scenario: 指标字段齐全
- **WHEN** 请求 `GET /api/lowvol/index/932422`
- **THEN** `data.series` 中包含并填充（在满足窗口后）：`dividendYieldPct/spreadRawPct/spreadSmoothPct/spreadPct/spreadPctRank5y/biasPct3y/biasPct3y60` 等字段

### Requirement: 失败时显式报错
系统 SHALL 在 TRI 数据为空/不足/无法对齐时返回明确错误，以触发前端错误态展示。

#### Scenario: TRI 不可用
- **WHEN** TRI 拉取失败或返回空数组，或 PRI/TRI 重叠样本不足（例如 < 253）
- **THEN** API 返回失败响应并携带可读 `message`（例如"TRI 数据不足或无法对齐，无法计算股息率/利差：932422"）

### Requirement: 简介一致性
系统 SHALL 保证"指数卡片上的编制简介"与"指数页面顶部介绍第一段"完全一致。

#### Scenario: 文案一致
- **WHEN** 用户切换到 932422
- **THEN** 卡片展示的简介与面板顶部第一段介绍一致

## MODIFIED Requirements
### Requirement: 低波支持指数集合
系统 SHALL 将低波机会的支持指数集合扩展为包含 932422 A500红利低波，并保持现有指数行为不变。

## REMOVED Requirements
无
