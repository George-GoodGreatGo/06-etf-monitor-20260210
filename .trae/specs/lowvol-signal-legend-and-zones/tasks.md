# Tasks

- [x] Task 1: 低波机会背景容器对标大盘看板
  - [x] 在 `LowVolOpportunityPanel` 引入大盘看板风格的背景容器区域承载图表与顶部说明/控制

- [x] Task 2: 顶部统一说明区（规则+指标定义）
  - [x] 在 `LowVolOpportunityChart` 顶部增加说明区，展示建议规则与指标口径摘要
  - [x] 处理 hover 面板与说明区的遮挡关系（位置避让或折叠）

- [x] Task 3: 分位背景带可见性修复与增强
  - [x] 将背景带渲染为图表叠加层（位于绘制层之上且不阻塞交互）
  - [x] 背景带位置随缩放/尺寸变化更新，且避开右侧价格刻度区域

- [x] Task 4: 回归验收
  - [x] `npm run check` 与 `npm run lint` 无新增 error
  - [x] 手动验收：背景带可见；说明区内容正确；与 hover/控制区不遮挡；对标看板容器一致

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1-3
