# Tasks
- [x] Task 1: 扩充语录数据到 15 条
  - [x] 在 `src/data/quotes.ts` 增补语录至 15 条（建议每位作者 5 条）
  - [x] 补齐出处字段（source 不为空，且表述一致）
  - [x] 校验中英文均可读、长度适配轮播卡片

- [x] Task 2: 首页风格化升级（去 AI 味）
  - [x] 调整 `QuoteHome` 的版式与留白，强化“冷静、专业、品味”
  - [x] 降低辅助文案的营销感，强化原则导向表达
  - [x] 提升背景质感（低饱和渐变/纹理），但保持性能友好

- [x] Task 3: 轮播动效与控件克制化
  - [x] 切换动效改为更顺滑的淡入淡出/小位移（150–250ms）
  - [x] 控件（上一条/下一条/暂停/指示点）样式更轻、更不抢内容
  - [x] 保留可访问性（aria-label、focus-visible）

- [x] Task 4: 回归与验收
  - [x] 首页语录为 15 条，且中英与出处齐全
  - [x] 视觉风格达到“专业冷静”，动效不突兀
  - [x] 移动端可用且不卡顿
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
