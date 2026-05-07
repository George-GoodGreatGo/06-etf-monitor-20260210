# Tasks

- [x] Task 1: 修正 `computeRsi` 函数 — 对齐图表 `buildRsi` 算法
  - [x] SubTask 1.1: 初始化改为从数组开头取前 `period` 个变化值（而非数组末尾）
  - [x] SubTask 1.2: 零增益零损失时返回 50（对齐 `computeRsiValue`）
  - [x] SubTask 1.3: 验证结果与图表 `buildRsi(prices, 14)[last]` 一致

- [x] Task 2: 修正 `resolveScoreState` 颜色 — 红涨绿跌
  - [x] SubTask 2.1: `score > 0` 分支改为红色系（`text-[#EF4444]`、`border-[rgba(239,68,68,...)]` 等）
  - [x] SubTask 2.2: `score < 0` 分支改为绿色系（`text-[#10B981]`、`border-[rgba(16,185,129,...)]` 等）
  - [x] SubTask 2.3: 确认与 `pctToneCls` 颜色惯例一致

- [x] Task 3: 主指标行布局从 flex 改为 grid 均分 + 高度压缩 + ZBadge 移除
  - [x] SubTask 3.1: 主指标行改为 `grid grid-cols-3 sm:grid-cols-6`，items 内嵌 `border-r` 竖分隔线 + `last:border-r-0`
  - [x] SubTask 3.2: Score 字号 `text-2xl` → `text-xl`，其他主指标值 `text-lg` → `text-base`，容器 padding `p-5` → `p-4`
  - [x] SubTask 3.3: Score Badge 从独立行移到 Score 块内与数值同行
  - [x] SubTask 3.4: 90日 Z 值从 `<ZBadge>` 改为纯文本 `font-mono text-base font-semibold`，颜色跟随正负

- [x] Task 4: 同步更新 Mock HTML
  - [x] SubTask 4.1: 主指标行改为 `grid grid-cols-3 sm:grid-cols-6` 均分布局
  - [x] SubTask 4.2: Score 红色、Z值纯文本、高度压缩、RSI 58.3

- [x] Task 5: 回归验证
  - [x] SubTask 5.1: `tsc --noEmit` 零错误
  - [x] SubTask 5.2: `eslint RpsStylePanel.tsx` 零错误
  - [x] SubTask 5.3: 确认 `ZBadge` 导入已被安全移除（仅此文件无其他引用）
  - [x] SubTask 5.4: 确认 Hero 仍包裹在 `{customQueryLatest ? ... : null}` 中

# Task Dependencies
- Task 1、Task 2、Task 3 互不依赖，可并行
- Task 4 依赖 Task 1、2、3 完成（参考最终样式）
- Task 5 依赖 Task 1、2、3、4 完成
