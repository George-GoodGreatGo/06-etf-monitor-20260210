# 新增首页：理性投资金句轮播 Spec

## Why
当前应用以数据与信号为主，缺少“行为层面的提醒”。新增一个首页，用高质量金句在进入系统时强化理性、耐心与风险意识，帮助用户在做投资决策前先回到正确的心态。

## What Changes
- 新增“首页（Quotes）”页面：以动效轮播方式展示经典语录/金句。
- 每条语录同时展示中文与英文，并展示出处（书籍/采访/演讲/致股东信等）。
- 版面具备设计感（暗色背景、层次、留白、对比），动效克制且顺滑。
- 提供基础交互：
  - 自动轮播（可暂停）
  - 手动切换（上一条/下一条、指示点）
- 导航接入：
  - 左侧一级导航新增“首页”入口并置于顶部
  - 登录后默认进入首页
- **兼容性**：原监测页面入口保持可达（通过左侧导航进入）。

## Impact
- Affected specs: 导航结构、默认落地页
- Affected code:
  - `src/App.tsx`：路由调整与旧入口兼容跳转
  - `src/components/SideNav.tsx`：新增“首页”入口
  - `src/pages/*`：新增首页页面组件

## ADDED Requirements
### Requirement: 首页轮播语录
系统 SHALL 提供首页页面并以轮播方式展示语录内容。

#### Data Model
每条语录 SHALL 包含：
- `id`：唯一标识
- `author`：作者（Buffett/Munger/Marks）
- `quoteZh`：中文内容
- `quoteEn`：英文内容
- `source`：出处（可读字符串）

#### Scenario: 自动轮播
- **WHEN** 用户进入首页并停留
- **THEN** 系统每 6–10 秒自动切换到下一条语录
- **AND** 切换有平滑过渡动效（opacity/translate 等）

#### Scenario: 手动切换
- **WHEN** 用户点击上一条/下一条或指示点
- **THEN** 立即切换到对应语录并带同等动效

#### Scenario: 暂停
- **WHEN** 用户点击“暂停/播放”
- **THEN** 自动轮播停止/恢复
- **AND** 暂停状态在本次会话内保持（不强制持久化）

### Requirement: 中英文与出处
系统 SHALL 在同屏展示中文与英文，并展示出处，且层次清晰易读。

#### Scenario: 信息完整
- **WHEN** 任意语录展示
- **THEN** 可同时看到中文、英文与出处

## MODIFIED Requirements
### Requirement: 默认落地页
系统 SHALL 在登录后默认进入“首页（Quotes）”。

#### Scenario: 登录后跳转
- **WHEN** 用户完成登录
- **THEN** 若无显式 next 参数，默认进入首页

## REMOVED Requirements
无

