# 分析方法策略切换改为 Tab 页签 Spec

## Why
当前「分析方法」页面的策略切换使用一个完整的卡片（border + 背景）包裹两个圆角胶囊按钮，视觉占比过大、信息层级混乱，且缺乏专业的 Tab 页签语义。需要将策略选择器重构为面包屑下方的轻量级 Tab 页签栏，提升页面信息架构的专业度。

## What Changes
- 删除「分析方法」页面中现有的 Strategy Selector 卡片区块
- 在面包屑导航下方新增策略 Tab 页签栏（使用 `border-b-2` 底部指示器区分激活态）
- 保留策略描述文字作为 Tab 栏副标题
- Tab 栏交互复用现有 URL 参数机制（`?strategy=xxx`），通过 `<Link>` 切换策略
- **BREAKING**: 无破坏性变更，仅视觉层 UI 重构

## Impact
- Affected specs: 无（全新 spec）
- Affected code: `src/pages/MarketRpsMethodology.tsx`（仅此一个文件）

## ADDED Requirements

### Requirement: 策略 Tab 页签栏
系统 SHALL 在「分析方法」页面面包屑导航下方展示策略 Tab 页签栏，替代原有的卡片式策略选择器。

#### Scenario: 页面加载默认显示
- **WHEN** 用户访问 `/market/rps/methodology`（无 strategy 参数）
- **THEN** Tab 栏中「Baseline策略」为激活态（底部显示青色指示条）
- **AND** 「基础颜色切换」为非激活态
- **AND** 策略描述文字显示「Baseline策略」的说明

#### Scenario: 通过 URL 参数指定策略
- **WHEN** 用户访问 `/market/rps/methodology?strategy=baseColorFlip`
- **THEN** Tab 栏中「基础颜色切换」为激活态
- **AND** 「Baseline策略」为非激活态

#### Scenario: 点击 Tab 切换策略
- **WHEN** 用户点击非激活态的 Tab 项
- **THEN** 页面通过 React Router `<Link>` 跳转到对应 URL
- **AND** 页面内容（规则正文、回测数据等）同步切换为对应策略的数据

### Requirement: Tab 页签视觉样式
系统 SHALL 为策略 Tab 页签提供专业的深色主题 Dashboard 风格样式。

#### Scenario: Tab 项默认态
- **WHEN** Tab 项处于非激活状态
- **THEN** 文字颜色为 `text-[#94A3B8]`（Slate-400）
- **AND** 底边为透明（`border-transparent`）
- **AND** hover 时文字变白、底边微亮

#### Scenario: Tab 项激活态
- **WHEN** Tab 项处于激活状态
- **THEN** 文字颜色为 `text-white`
- **AND** 底边显示 2px 青色指示条 `border-[#7DD3FC]`

#### Scenario: 角色徽章
- **WHEN** 策略角色为「默认策略」
- **THEN** 徽章显示浅青底 + 青文字
- **WHEN** 策略角色为「对照策略」
- **THEN** 徽章显示浅灰底 + 灰文字

### Requirement: Tab 栏过渡动画
系统 SHALL 为 Tab 切换提供平滑的 CSS 过渡动画。

#### Scenario: Tab 状态切换
- **WHEN** 用户 click/hover Tab 项
- **THEN** 文字颜色使用 `transition-all duration-200 ease-in-out` 平滑过渡
- **AND** 底边指示器颜色平滑过渡

### Requirement: 策略描述副标题
系统 SHALL 在 Tab 栏下方显示当前选中策略的简短描述文字。

#### Scenario: 描述文字展示
- **WHEN** Tab 栏渲染完成
- **THEN** 下方显示灰色小字策略描述（`text-xs text-[#64748B]`）
- **AND** 描述内容来自 `selectedStrategy.selectorDescription`

### Requirement: 间距与布局
系统 SHALL 保持面包屑与 Tab 栏、Tab 栏与内容区的合理间距。

#### Scenario: 面包屑到 Tab 栏间距
- **WHEN** 页面渲染完成
- **THEN** 面包屑与 Tab 栏之间间距为 `mb-3`（12px）

#### Scenario: Tab 栏到内容区间距
- **WHEN** 页面渲染完成
- **THEN** Tab 栏（含描述文字）与第一个内容卡片之间间距为 `mb-5`（20px）

## MODIFIED Requirements
无

## REMOVED Requirements

### Requirement: 旧版 Strategy Selector 卡片
**Reason**: 视觉占比过大、层级混乱，与专业 Tab 页签设计语言不一致。
**Migration**: 自动由新的 Tab 栏替代，无需用户或数据迁移。

#### Scenario: 旧卡片已移除
- **WHEN** 页面渲染完成
- **THEN** 原 `<section>` Strategy Selector 卡片不再出现
- **AND** 原"STRATEGY SELECTOR"标题、"策略选择"标题不再显示
- **AND** 原 `rounded-full` 胶囊按钮不再显示
