# 低波机会：BIAS 基准开关 UI 与层级调整 Spec

## Why
当前 BIAS 基准切换控件位于图表内部，层级不够直观，且样式偏“分段按钮”。需要将其提升到与“指数切换”同层级，并改为更明确的 iOS 风格开关样式，强调其对所有指数均生效。

## What Changes
- 将“BIAS基准（SMA250/SMA60）”切换控件从图表控制区移出
- 在“低波机会”Tab 的指数切换行（与指数胶囊同一行最右侧）展示该开关
- 开关样式改为 iOS/苹果手机风格的滑动开关（toggle）
- 交互约定：
  - 默认：SMA250（开关关闭态）
  - 开关打开：SMA60
  - 切换后对“低波机会”下全部指数立即生效（不随指数切换重置）
- 文案统一清晰表达层级：在开关旁显示 “BIAS基准” 与当前档位（SMA250 / SMA60）

## Impact
- Affected specs: 低波机会二级导航行布局、BIAS 基准切换控件 UI
- Affected code:
  - src/pages/Home.tsx
  - src/components/LowVolOpportunityPanel.tsx
  - src/components/charts/LowVolOpportunityChart.tsx

## ADDED Requirements
### Requirement: 指数切换行右侧开关
系统 SHALL 在低波机会“指数切换行”右侧展示 BIAS 基准切换开关。

#### Scenario: 视觉层级
- **WHEN** 用户进入低波机会 Tab
- **THEN** 用户可以在指数切换行右侧看到“BIAS基准”开关；图表内部不再重复出现该开关

### Requirement: iOS 风格开关
系统 SHALL 使用 iOS 风格滑动开关样式呈现 SMA250/SMA60 的二选一。

#### Scenario: 状态映射
- **WHEN** 开关处于关闭态
- **THEN** 表示 BIAS 基准为 SMA250
- **WHEN** 开关处于打开态
- **THEN** 表示 BIAS 基准为 SMA60

## MODIFIED Requirements
### Requirement: 基准切换对所有指数生效
系统 SHALL 保持基准切换为全局状态：切换后对低波机会下所有指数生效，且在切换指数时不重置。

## REMOVED Requirements
（无）

