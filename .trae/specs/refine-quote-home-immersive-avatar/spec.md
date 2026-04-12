# 首页沉浸式改版：聚焦语录 + 作者头像 Spec

## Why
当前首页虽已“去 AI 味”并强化专业气质，但仍存在信息元素偏多（左侧说明段落、下方提示等），沉浸感不够强。希望进一步减少视觉干扰，把注意力集中在投资大师的语录上，并在语录展示中加入作者头像，提升“人物感”与仪式感。

## What Changes
- 首页整体布局改为更沉浸式的“单主题展示”：
  - 以语录卡片为绝对主角（居中、全幅/接近全幅）
  - 弱化或移除其它说明性文字与额外卡片/段落（保留最必要信息：作者、出处）
- 轮播展示加入作者头像：
  - 每条语录展示作者头像（圆形/方圆角头像位）
  - 若无真实照片素材，提供“风格化头像占位”（单色剪影或首字母徽章）以满足头像呈现
- 动效进一步克制与沉稳：
  - 切换更像“翻页/淡入”而非跳动
  - 控件更隐形（hover 才增强对比），默认不抢内容
- 仍保持现有能力：
  - 自动轮播、暂停/播放、上一条/下一条、指示点
  - 中英文同屏 + 出处展示

## Impact
- Affected specs: Quotes 首页的视觉与信息密度策略
- Affected code:
  - `src/pages/QuoteHome.tsx`：布局收敛，移除非核心信息
  - `src/components/QuoteCarousel.tsx`：加入头像区域与更沉浸式视觉
  - `src/data/quotes.ts`：为作者补充头像元信息（如 avatarKind/avatarText/avatarSrc）
  - `src/components/*`：可能新增轻量 Avatar 组件（不引入新库）

## ADDED Requirements
### Requirement: 沉浸式首页
系统 SHALL 将首页改为沉浸式呈现，减少非核心元素，聚焦语录内容。

#### Scenario: 视觉聚焦
- **WHEN** 用户进入首页
- **THEN** 首屏主体为语录（中文主句 + 英文副句）
- **AND** 页面中不出现与语录无关的营销/说明模块（仅保留作者与出处）

### Requirement: 作者头像展示
系统 SHALL 在语录展示区域呈现作者头像。

#### Scenario: 有照片素材
- **WHEN** 为作者提供头像资源（本地静态图片）
- **THEN** 显示对应作者头像

#### Scenario: 无照片素材
- **WHEN** 未提供作者照片素材
- **THEN** 显示风格化头像占位（剪影/首字母徽章），并保持整体风格统一

### Requirement: 控件克制
系统 SHALL 让轮播控件默认低存在感，hover/聚焦时清晰可用，避免抢占语录注意力。

## MODIFIED Requirements
### Requirement: QuoteHome 信息密度
系统 SHALL 在 QuoteHome 页面移除或弱化当前的说明段落/提示文本，保留最必要信息层级（作者与出处）。

## REMOVED Requirements
无

