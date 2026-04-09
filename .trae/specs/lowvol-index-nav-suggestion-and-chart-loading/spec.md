# 低波机会：二级导航建议标签 + 图表区 Loading Spec

## Why
当前低波机会在首次加载/切换指数时，图表区域缺少显式 loading 反馈；且二级指数切换仅展示名称与 code，不够直观地体现“当前各指数的操作建议”。

## What Changes
- 在低波机会首次加载与切换指数时，在**图表区域**展示 loading 覆盖层（样式对标大盘看板图表 loading）。
- 在低波机会“指数切换”二级导航中，为每个指数增加“操作建议”标签（如：偏配置/偏减仓/偏观望/—），便于快速对比。
- **兼容**现有信号规则与阈值，不改动指标口径；仅增强展示与交互反馈。

## Impact
- Affected specs: 低波机会 UI 交互反馈、二级导航信息密度
- Affected code:
  - `src/pages/Home.tsx`：二级导航 UI 与建议标签展示
  - `src/components/LowVolOpportunityPanel.tsx`：图表区域 loading 覆盖层
  - `src/utils/marketApi.ts`（可选）：若需要新增轻量 summary 接口/函数
  - （可选）新增 `src/utils/lowVolSuggestion.ts` 之类的纯函数复用建议规则

## ADDED Requirements
### Requirement: 图表区域 Loading
系统 SHALL 在低波机会**首次加载**与**切换指数**触发数据请求时，于图表区域显示 loading 覆盖层。

#### Scenario: 首次进入低波机会
- **WHEN** 用户切换到“低波机会”Tab，且数据尚未返回
- **THEN** 图表区域显示 loading 覆盖层（不遮挡整个页面，只覆盖图表容器）
- **AND** 数据返回后 loading 覆盖层消失并展示图表

#### Scenario: 切换指数
- **WHEN** 用户点击二级导航切换指数
- **THEN** 图表区域立即进入 loading 覆盖层
- **AND** 数据返回后更新图表并退出 loading
- **AND** 若请求失败，展示错误态（沿用现有 DataStatusBanner 逻辑），不再显示 loading 覆盖层

### Requirement: 二级导航建议标签
系统 SHALL 在低波机会的指数切换二级导航中，为每个指数展示“操作建议”标签。

#### Scenario: 建议标签渲染
- **WHEN** 低波机会 Tab 可见
- **THEN** 每个指数项展示一个建议标签：
  - 偏配置（绿色）
  - 偏减仓（红色）
  - 偏观望（灰色）
  - —（数据不足/不可用时）

#### Scenario: 建议规则一致性
- **WHEN** 建议标签基于指标计算
- **THEN** 使用与图表/摘要卡相同的阈值规则（当前：利差分位(10年)≥80 且 BIAS分位(3年)≤20 为偏配置（强）；BIAS分位(3年)≥85 为偏减仓（强）；其余为偏观望/—）

## MODIFIED Requirements
### Requirement: 低波机会信息结构
系统 SHALL 将“建议”信息同时体现在：
- 二级导航每个指数项的建议标签（对比视角）
- 当前选中指数的摘要卡/hover 建议（细节视角）

## REMOVED Requirements
无

