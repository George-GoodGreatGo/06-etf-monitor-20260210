# Tasks
- [ ] Task 1: 明确自定义查询页面精简布局与图表联动的改造边界
  - [ ] SubTask 1.1: 梳理当前自定义查询页中哪些容器属于冗余嵌套，哪些信息必须保留
  - [ ] SubTask 1.2: 明确三张图当前的同步现状，与“大盘看板”联动实现对照差异
  - [ ] SubTask 1.3: 确定布局压平后各区块的层级、间距与标题组织方式

- [ ] Task 2: 精简自定义查询页面布局
  - [ ] SubTask 2.1: 减少不必要的边框、卡片包裹层与重复标题区域
  - [ ] SubTask 2.2: 重组指标区、图表区与成交额区的布局，提高页面一目了然程度
  - [ ] SubTask 2.3: 保证布局精简后原有指标、图表和成交额信息仍完整可见

- [ ] Task 3: 对齐三张图的光标与日期联动
  - [ ] SubTask 3.1: 参考“大盘看板”实现，为三图补齐共享 hover 日期与十字光标同步逻辑
  - [ ] SubTask 3.2: 校对三图在拖拽、缩放后仍保持日期范围一致
  - [ ] SubTask 3.3: 修复当前 hover 任一图表时其余图表光标与日期未对齐的问题

- [ ] Task 4: 回归验证与交付
  - [ ] SubTask 4.1: 运行相关前端检查（如 `lint`、`typecheck`）并修复直接相关问题
  - [ ] SubTask 4.2: 验证页面布局已精简、三图 hover 日期联动正常、拖拽缩放后同步行为稳定

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
