# Tasks
- [x] Task 1: 梳理当前自定义查询页配色、搜索栏样式与多图时间轴的现状入口
  - [x] SubTask 1.1: 确认主图四档价格线与淡紫色放量提示当前使用的色值和复用位置
  - [x] SubTask 1.2: 确认顶部搜索栏当前容器、输入框、按钮与状态样式的实现入口
  - [x] SubTask 1.3: 确认四图中日期轴当前挂载位置与可见性控制方式

- [x] Task 2: 精修自定义查询主图与放量提示配色
  - [x] SubTask 2.1: 调整绿色、黄色、橙色、红色四档线段的实际色值，使视觉更舒适
  - [x] SubTask 2.2: 调整淡紫色放量圆点与成交金额追踪高亮的色值，使其更柔和统一
  - [x] SubTask 2.3: 保证新配色在深色背景下仍具备足够可读性和区分度

- [x] Task 3: 将顶部搜索栏重构为更接近 Google / Bing 的简洁搜索样式
  - [x] SubTask 3.1: 弱化当前厚重外框与过强阴影，改为更自然的一体式圆角搜索容器
  - [x] SubTask 3.2: 调整输入框与“查询”按钮的比例、间距和视觉层级，让整体更协调
  - [x] SubTask 3.3: 保证默认、hover、focus、loading 状态都清晰且不破坏深色主题

- [x] Task 4: 将日期轴下移到 RSI(14) 副图
  - [x] SubTask 4.1: 调整四图时间轴显示策略，仅在最底部 `RSI(14)` 副图显示日期轴
  - [x] SubTask 4.2: 保证主图、Score 副图和 RPS 起点归一副图不再重复显示日期轴
  - [x] SubTask 4.3: 验证时间轴下移后 hover、十字光标、缩放和可见范围联动不回退

- [x] Task 5: 回归验证与交付
  - [x] SubTask 5.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [x] SubTask 5.2: 验证新配色已在主图与放量高亮处统一生效，且观感更舒适
  - [x] SubTask 5.3: 验证搜索栏已呈现更简洁的一体式搜索体验
  - [x] SubTask 5.4: 验证日期轴已移动到底部 `RSI(14)` 副图，且四图联动正常

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 2, Task 3, and Task 4
