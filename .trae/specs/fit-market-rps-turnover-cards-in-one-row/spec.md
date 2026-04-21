# 市场风格 RPS 成交金额追踪卡片单行完整展示 Spec

## Why
当前“成交金额追踪”板块的目标 ETF 卡片虽然已经压缩并采用网格布局，但仍会分成多行展示。用户希望进一步缩小卡片宽度，让当前所有目标 ETF 卡片在同一行内完整呈现，以便更快进行横向对比。

## What Changes
- 进一步压缩“成交金额追踪”板块中目标 ETF 卡片的宽度与内部留白。
- 将当前所有目标 ETF 卡片调整为单行完整展示。
- 取消当前多行网格布局，改为单行固定排列。
- 保留卡片信息结构、选中态样式与点击切换成交额历史表的交互。

## Impact
- Affected specs: 市场风格 RPS 成交金额追踪卡片布局、单行对比体验
- Affected code: `src/components/RpsStylePanel.tsx`

## ADDED Requirements
### Requirement: 单行完整展示当前所有目标ETF
系统 SHALL 让当前“成交金额追踪”板块中的所有目标 ETF 卡片在同一行内完整展示，不再分成多行。

#### Scenario: 板块完成渲染
- **WHEN** 用户查看 `成交金额追踪` 板块
- **THEN** 当前全部目标 ETF 卡片显示在同一行
- **AND** 不再出现当前目标 ETF 集合下的自动换行

### Requirement: 进一步压缩卡片宽度
系统 SHALL 在不改变核心信息结构的前提下继续压缩卡片宽度与内部留白，以适配单行完整展示。

#### Scenario: 用户查看单张卡片
- **WHEN** 卡片完成渲染
- **THEN** 单卡宽度较旧布局进一步缩小
- **AND** 卡片仍保留名称、代码、放量标签与日期信息的可读性

## MODIFIED Requirements
### Requirement: 成交金额追踪卡片布局
系统 SHALL 将“成交金额追踪”板块中的目标 ETF 卡片布局从多行网格调整为当前目标 ETF 集合下的单行展示布局，以提升横向扫描效率。

#### Scenario: 当前目标ETF集合展示
- **WHEN** 板块按当前支持的目标 ETF 集合渲染
- **THEN** 卡片列表以单行方式完整展示
- **AND** 点击任一卡片后，下方成交额历史表联动逻辑保持不变

## REMOVED Requirements
### Requirement: 当前目标ETF集合下的多行卡片展示
**Reason**: 多行布局会增加垂直视线跳转成本，不利于快速横向比较。  
**Migration**: 改为进一步缩窄卡片后，在当前目标 ETF 集合下统一单行展示。
