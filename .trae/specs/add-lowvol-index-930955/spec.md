# 低波机会新增指数：红利低波100（930955）Spec

## Why
低波机会当前仅覆盖 3 个指数。需要在指数切换 Tab 中新增“中证红利低波动100指数（930955）”（简称“红利低波100”），以便在同一套低波机会框架下对该指数进行分析、建议与图表展示。

## What Changes
- 在低波机会指数切换中新增一个选项：红利低波100（930955）
- 该指数的加载、图表、BIAS 基准切换（SMA250/SMA60）、操作建议、二级导航建议标签等行为与现有指数保持一致
- 服务端 lowVol 数据源配置新增 930955 的 PRI/TRI 指数代码映射，确保可计算股息率/利差/分位/BIAS 等指标

## Impact
- Affected specs: 低波机会指数切换与数据加载、服务端 lowVol 指数配置
- Affected code:
  - src/pages/Home.tsx
  - server/lib/lowVol.ts
  - （可选）server/scripts/checkLowVolIndex.ts（用于验证）

## ADDED Requirements
### Requirement: 新增指数入口
系统 SHALL 在低波机会指数切换处展示“红利低波100（930955）”选项。

#### Scenario: 正常加载
- **WHEN** 用户在低波机会 Tab 点击“红利低波100（930955）”
- **THEN** 系统加载该指数数据并渲染图表与建议，行为与其他指数一致

### Requirement: 930955 数据可计算
系统 SHALL 为 930955 配置可用的 PRI 与 TRI 数据源，以便计算股息率/利差/分位与 BIAS 指标。

#### Scenario: TRI 配置有效
- **WHEN** 服务端拉取 930955 的 PRI 与 TRI 序列
- **THEN** TRI 与 PRI 可对齐且覆盖不少于 253 个交易日，且接口返回成功

## MODIFIED Requirements
（无）

## REMOVED Requirements
（无）

