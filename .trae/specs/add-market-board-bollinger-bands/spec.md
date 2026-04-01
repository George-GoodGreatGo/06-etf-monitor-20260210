# 沪深市场大盘看板主图添加长周期布林带（BOLL120）Spec

## Why
当前大盘看板主图仅包含价格与均线（EMA），缺少衡量“长周期波动范围/收口开口”的可视化指标。为大盘或稳健型标的提供 BOLL120，有助于辅助判断波动率状态与相对位置。

## What Changes
- 在「沪深市场大盘看板」主图（沪深300）上新增布林带三条曲线：中轨（MB）、上轨（UB）、下轨（LB）。
- 新增布林带显示/隐藏开关，交互与现有指标按钮一致（与 EMA 开关同一工具栏）。
- 在主图悬浮信息中（hover/legend）补充布林带数值与带宽（Bandwidth）展示（仅在布林带开启时显示）。
- 新增一个布林带计算模块（TypeScript），严格按指定文字逻辑计算：
  - N = 120（日）
  - K = 2.0
  - 中轨：过去 N 天 close 的简单移动平均
  - 标准差：过去 N 天 close 的样本标准差
  - 上/下轨：MB ± K*Std
  - 带宽：(UB - LB) / MB
  - 前 N-1 天无法计算时，四项结果填充为 null（或等价的缺失值），保证程序不报错且结果长度与输入一致
- **代码需包含清晰的中文注释**，说明计算含义、异常/边界处理。

## Impact
- Affected specs: 首页「沪深市场大盘看板」主图指标体系（新增 BOLL120）
- Affected code:
  - `src/components/charts/MarketLiquidityChart.tsx`（新增 BOLL 计算与渲染、开关按钮、hover 展示）
  - （可选）若后续希望复用：抽取到 `src/utils/` 的计算函数文件

## ADDED Requirements
### Requirement: BOLL120 计算与输出结构
系统 SHALL 基于按日期正序的日线数据（使用 close 字段）计算 BOLL120，并产出与输入长度完全一致的结果序列。

#### Scenario: 输出长度一致且前置填充
- **GIVEN** 输入为按时间正序排列的日线数据序列，包含 `close`
- **WHEN** 系统计算 BOLL120（N=120，K=2.0）
- **THEN** 每天都应对应产出 `mid`, `upper`, `lower`, `bandwidth` 四个字段
- **AND** 前 N-1 天四个字段为 null（或等价缺失值）
- **AND** 后续天数四个字段为有限数值（若遇到无效 close 或 MB=0，按缺失值处理，不抛异常）

### Requirement: 主图布林带渲染
系统 SHALL 在主图上展示/隐藏 BOLL120 三条轨道线。

#### Scenario: 开关控制
- **GIVEN** 用户正在查看大盘看板主图
- **WHEN** 用户开启 BOLL120
- **THEN** 主图显示 MB/UB/LB 三条曲线，并随时间轴联动与缩放
- **WHEN** 用户关闭 BOLL120
- **THEN** 主图隐藏 MB/UB/LB 三条曲线，其他元素（价格线、EMA、红/绿高亮段）不受影响

## MODIFIED Requirements
### Requirement: 主图 hover 信息扩展
hover 信息 SHALL 在现有字段基础上，根据 BOLL120 开关状态补充展示：
- MB、UB、LB（同主图价格单位）
- Bandwidth（无量纲，通常为小数）

## REMOVED Requirements
N/A
