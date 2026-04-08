# 低波指数机会识别（红利低波 H30269）Spec

## Why
当前系统缺少对“低波/红利低波”类指数的长期估值与拥挤度信号看板，用户无法在一个稳定口径下快速识别“相对机会区/风险区”。需要新增同级 Tab，并提供可解释的长期序列与分位信号。

## What Changes
- 在首页同级 Tab 新增「低波指数机会识别」入口（与 ETF列表、AI解读、大盘看板同级）。
- 在该 Tab 展示红利低波指数（H30269）的图表，支持 5 个视图切换：
  - 指数点位（逐日）
  - 250 日均线乖离率 BIAS（逐日）
  - BIAS 3 年滚动分位数（逐日）
  - 股息率 - 10Y 国债收益率利差（绝对值，逐日）
  - 利差 3 年滚动分位数（逐日）
- 新增服务端 API 输出上述指标的逐日序列，并在 `meta` 中声明数据口径、单位与数据源。
- 数据源口径：红利低波指数“股息率”优先使用中证指数（csindex）作为权威口径；10Y 国债收益率沿用现有 chinamoney 数据源。

## Impact
- Affected specs: 首页 Tab 结构、指数级图表渲染、数据源拉取与计算
- Affected code:
  - 前端：`src/pages/Home.tsx`（新增 tab）、新增 `LowVolOpportunityPanel` 与图表组件
  - 后端：新增路由 `server/routes/lowVol.ts`（或合并到 market 路由）、扩展 `server/lib/csindex.ts`（支持 H30269 数据）、复用 `server/lib/chinamoneyGovBond.ts`

## ADDED Requirements
### Requirement: 新增同级 Tab
系统 SHALL 在首页增加「低波指数机会识别」Tab，作为与现有三 Tab 同级入口。

#### Scenario: 进入 Tab
- **WHEN** 用户点击「低波指数机会识别」
- **THEN** URL query `tab` 更新为新值（例如 `tab=lowvol`）
- **AND** 页面渲染红利低波（H30269）机会识别面板

### Requirement: 指标序列 API
系统 SHALL 提供服务端 API 返回红利低波（H30269）自可得历史以来的逐日序列，并包含计算后的派生字段。

#### Output Schema（最小字段集）
- `meta`
  - `fetchedAt`：ISO 字符串
  - `dataDate`：最新数据日期（YYYY-MM-DD）
  - `source`：字符串，描述数据源组合（例如 `csindex + chinamoney`）
  - `notes`：字符串数组，声明口径与单位
- `data.series[]`（按日期升序）
  - `date`：YYYY-MM-DD
  - `close`：指数收盘点位（点）
  - `ma250`：250 日简单移动平均（点）
  - `bias250`：乖离率（无量纲，小数），`(close-ma250)/ma250`
  - `biasPct3y`：3 年滚动分位数（0-100，%）
  - `dividendYieldPct`：指数股息率（%）
  - `yield10yPct`：10Y 国债收益率（%）
  - `spreadPct`：利差（百分点），`dividendYieldPct - yield10yPct`
  - `spreadPctRank3y`：利差 3 年滚动分位数（0-100，%）

#### Scenario: 正常返回
- **WHEN** 前端请求红利低波序列 API
- **THEN** 返回 `data.series`（日期升序）
- **AND** `meta.notes` 明确说明：
  - BIAS 口径（250 日 SMA）
  - 滚动分位数窗口（3 年，按交易日近似 756 个样本）
  - 股息率数据源（csindex）
  - 10Y 数据源（chinamoney）

### Requirement: 图表视图与切换
系统 SHALL 在「低波指数机会识别」Tab 提供 5 个视图切换，且每个视图均以同一条 `data.series` 为数据源，确保口径一致。

#### Scenario: 指数点位
- **WHEN** 用户选择“指数点位”
- **THEN** 绘制 `close`（可选叠加 `ma250`）

#### Scenario: BIAS
- **WHEN** 用户选择“BIAS(250)”
- **THEN** 绘制 `bias250`（可选绘制 0 线基准）

#### Scenario: BIAS 分位
- **WHEN** 用户选择“BIAS 分位(3年)”
- **THEN** 绘制 `biasPct3y`（0-100）

#### Scenario: 利差
- **WHEN** 用户选择“股息率-10Y利差”
- **THEN** 绘制 `spreadPct`

#### Scenario: 利差分位
- **WHEN** 用户选择“利差分位(3年)”
- **THEN** 绘制 `spreadPctRank3y`（0-100）

## MODIFIED Requirements
### Requirement: 首页 Tab 解析
系统 SHALL 将首页 `tab` 合法值集合扩展，新增 `lowvol`（或等价 key），且保持对非法值回退逻辑不变。

