# Tasks
- [ ] Task 1: 梳理“ETF自定义查询”搜索栏与图表控制的现状入口
  - [ ] SubTask 1.1: 确认顶部搜索栏容器、输入框、按钮在默认态、hover、focus 态的样式实现位置
  - [ ] SubTask 1.2: 确认前复权价格主图当前已渲染的价格线、`SMA60`、`SMA250`、放量标记与图例入口
  - [ ] SubTask 1.3: 确认各副图的实例管理、联动集合和显示控制入口，并对照“大盘看板”的稳定实现

- [ ] Task 2: 提升顶部搜索栏的首屏可见性
  - [ ] SubTask 2.1: 调整搜索栏背景、边框、发光或阴影，使其在深色背景下更明亮易辨识
  - [ ] SubTask 2.2: 校对输入框、搜索图标与“查询”按钮的视觉层级，避免按钮或输入区再次显得过暗
  - [ ] SubTask 2.3: 验证默认态、hover、focus、loading 态都清晰且与页面风格协调

- [ ] Task 3: 为前复权价格主图增加 `SMA20`
  - [ ] SubTask 3.1: 补齐 `SMA20` 所需的数据准备逻辑，明确其与现有价格序列的对齐方式
  - [ ] SubTask 3.2: 在主图渲染 `SMA20` 曲线，并与 `SMA60`、`SMA250` 保持区分度
  - [ ] SubTask 3.3: 验证新增 `SMA20` 后 hover、十字光标、可见范围同步不回退

- [ ] Task 4: 对标“大盘看板”增加主图指标控制项
  - [ ] SubTask 4.1: 在图表顶部增加主图指标控制区，覆盖价格主线、`SMA20`、`SMA60`、`SMA250` 等主图信号
  - [ ] SubTask 4.2: 实现主图指标的显示/隐藏切换，并保证切换不改变当前视窗与交互状态
  - [ ] SubTask 4.3: 校验控制项文案、默认开关状态与布局密度，避免遮挡图表主体

- [ ] Task 5: 对标“大盘看板”增加副图显示/隐藏开关
  - [ ] SubTask 5.1: 为各副图提供独立开关，并明确默认显示策略
  - [ ] SubTask 5.2: 实现副图隐藏时仅收起可见区域，不清空数据；重新开启时直接恢复显示
  - [ ] SubTask 5.3: 验证副图开关后剩余图表的 hover、十字光标、日期与范围联动仍正常

- [ ] Task 6: 回归验证与交付
  - [ ] SubTask 6.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [ ] SubTask 6.2: 验证搜索栏在首屏更醒目，且默认态、hover、focus 态反馈明确
  - [ ] SubTask 6.3: 验证主图已新增 `SMA20`，且主图指标控制项可以正常切换各指标显示
  - [ ] SubTask 6.4: 验证副图显示/隐藏开关行为与“大盘看板”一致，不出现空白、联动丢失或需重新查询的问题

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1 and Task 3
- Task 5 depends on Task 1
- Task 6 depends on Task 2, Task 3, Task 4, and Task 5
