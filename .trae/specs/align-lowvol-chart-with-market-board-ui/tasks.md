# Tasks

- [x] Task 1: 图表容器与间距对标大盘看板
  - [x] 对齐背景色/边框/圆角/内边距（参考 `MarketLiquidityChart` 外层容器与标题区）
  - [x] 主图与副图、以及副图间距与分隔线对齐看板（gap + border 规则）

- [x] Task 2: 统一 Hover 信息面板
  - [x] 新增单一 hover 面板组件/区域（参考看板 hover 展示方式）
  - [x] hover 任意图时，面板展示同日的主图与各副图指标值
  - [x] 避免与主图标题/控制区遮挡，层级与定位对齐看板

- [x] Task 3: 顶部控制区（指标/副图显示）
  - [x] 增加主图 MA250 显示/隐藏开关
  - [x] 增加 4 条副图显示/隐藏开关（BIAS、BIAS分位、利差平滑、利差分位）
  - [x] 隐藏副图时回收高度且联动逻辑仅作用于可见图

- [x] Task 4: 回归验收
  - [x] 运行 `npm run check` 与 `npm run lint` 无新增 error
  - [x] 手动验收：容器/间距与看板一致；hover 面板统一；开关交互正常；日期联动正常

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
