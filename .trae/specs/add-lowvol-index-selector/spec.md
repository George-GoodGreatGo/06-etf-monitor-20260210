# 低波机会：指数选择器 Spec

## Why
当前“低波机会”仅支持红利低波（H30269），无法在同一套指标框架下对比其它偏“类债权益”的指数。需要在同一 Tab 内快速切换指数并复用既有图表与信号规则。

## What Changes
- 前端在“低波机会”Tab 增加指数选择器（标签/Chip 形式），支持三项：红利低波（H30269）、中证全指自由现金流指数（932365）、中证全指红利质量指数（932315）。
- 用户切换后，面板与图表加载对应指数的序列数据并更新展示。
- 后端将低波序列计算能力泛化为“按指数配置加载”，并提供可按指数 code 请求的 API。
- 兼容保留现有 `GET /api/lowvol/h30269` 行为不变（内部可转调新实现）。

## Impact
- Affected specs: 低波机会图表（主图/副图/hover/建议规则）与数据加载
- Affected code:
  - 服务端：`server/lib/lowVol.ts`、`server/routes/lowVol.ts`
  - 前端：`src/components/LowVolOpportunityPanel.tsx`、`src/utils/marketApi.ts`、相关图表组件（如 `LowVolOpportunityChart.tsx`）

## ADDED Requirements
### Requirement: 指数选择器
系统 SHALL 在“低波机会”Tab 的图表区域上方提供指数选择器，包含三个标签选项：
- 红利低波（H30269）
- 中证全指自由现金流指数（932365）
- 中证全指红利质量指数（932315）

#### Scenario: 切换成功
- **WHEN** 用户点击任意未选中的指数标签
- **THEN** 当前选中态更新（视觉高亮）
- **AND** 触发数据重新加载（显示 loading 状态）
- **AND** 图表/右侧摘要卡片展示的新数据与所选指数一致
- **AND** hover、建议标签与分段着色使用同一套规则对新指数生效

#### Scenario: 重复点击
- **WHEN** 用户点击已选中的指数标签
- **THEN** 不触发重新加载（或触发但不影响 UI，一致性优先）

### Requirement: 低波机会序列 API（多指数）
系统 SHALL 提供一个按指数 code 获取序列数据的 API，并仅允许白名单内的指数 code。

#### Scenario: 请求成功
- **WHEN** 请求 `code` 属于 {H30269, 932365, 932315}
- **THEN** 返回结构与现有低波序列一致（`meta + data.series`）
- **AND** `meta.notes` 包含该指数的口径说明与数据源说明

#### Scenario: 请求失败（非法 code）
- **WHEN** 请求 `code` 不在白名单
- **THEN** 返回 400，并提供可读错误信息（不泄露内部实现细节）

## MODIFIED Requirements
### Requirement: 低波机会默认行为
系统 SHALL 默认选中红利低波（H30269），且在不操作选择器时行为与现有版本一致。

## REMOVED Requirements
无

