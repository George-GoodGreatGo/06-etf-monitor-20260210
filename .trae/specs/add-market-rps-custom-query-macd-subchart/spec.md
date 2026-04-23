# 自定义查询新增 MACD 副图 Spec

## Why
“自定义查询”当前只有既有副图，缺少用于观察短中期趋势拐点与动能节奏的 MACD 视图。需要在不破坏现有多图联动的前提下，补充一个日期严格对齐的 MACD 副图，增强单 ETF 研判能力。

## What Changes
- 在“自定义查询”图表区新增一个 MACD 副图，位置位于所有副图的第一顺位
- MACD 参数固定为 `(8, 21, 5)`，展示 `DIFF`、`DEA` 与 `MACD` 柱体
- 新增副图与现有主图、副图共享同一交易日坐标系，保证 hover、十字光标、可见范围和日期对齐
- 新增副图后，原有副图顺序整体后移，但现有指标口径、颜色语义与交互行为保持不变

## Impact
- Affected specs: 市场风格 RPS / 自定义查询图表联动 / 单 ETF 技术指标展示
- Affected code: 自定义查询图表组件、指标数据整理逻辑、图表联动与日期对齐逻辑

## ADDED Requirements
### Requirement: 自定义查询展示 MACD 副图
系统 SHALL 在“自定义查询”图表区增加一个 MACD 副图，并将其放在副图列表的第一顺位。

#### Scenario: 查询成功后展示 MACD
- **WHEN** 用户在“自定义查询”中成功加载某个 ETF 的图表数据
- **THEN** 页面在主图下方的第一张副图显示 MACD 视图
- **AND** 该视图使用 `(8, 21, 5)` 作为固定参数
- **AND** 该视图显示 `DIFF`、`DEA` 和 `MACD` 柱体

#### Scenario: MACD 与现有图表共享日期坐标
- **WHEN** 用户悬停、拖拽或缩放任意一张图表
- **THEN** MACD 副图与其余图表保持同一交易日定位
- **AND** MACD 副图的日期轴、十字光标与可见范围不会单独漂移

## MODIFIED Requirements
### Requirement: 自定义查询副图顺序
系统 SHALL 将 MACD 副图插入为“自定义查询”图表区的第一张副图，原有副图依次顺延，并继续保持既有日期对齐、hover 联动与数据解释口径。

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次仅新增视图能力，不移除既有需求。
**Migration**: 无需迁移，现有副图仅调整展示顺序。
