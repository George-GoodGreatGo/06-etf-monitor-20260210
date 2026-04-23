# Tasks
- [x] Task 1: 梳理“ETF自定义查询”搜索栏与图表控制的现状入口
  - [x] SubTask 1.1: 确认顶部搜索栏容器、输入框、按钮在默认态、hover、focus 态的样式实现位置
  - [x] SubTask 1.2: 确认前复权价格主图当前已渲染的价格线、`SMA60`、`SMA250`、放量标记与图例入口
  - [x] SubTask 1.3: 确认各副图的实例管理、联动集合和显示控制入口，并对照“大盘看板”的稳定实现

- [x] Task 2: 提升顶部搜索栏的首屏可见性
  - [x] SubTask 2.1: 调整搜索栏背景、边框、发光或阴影，使其在深色背景下更明亮易辨识
  - [x] SubTask 2.2: 校对输入框、搜索图标与“查询”按钮的视觉层级，避免按钮或输入区再次显得过暗
  - [x] SubTask 2.3: 验证默认态、hover、focus、loading 态都清晰且与页面风格协调

- [x] Task 3: 为前复权价格主图增加 `SMA20`
  - [x] SubTask 3.1: 补齐 `SMA20` 所需的数据准备逻辑，明确其与现有价格序列的对齐方式
  - [x] SubTask 3.2: 在主图渲染 `SMA20` 曲线，并与 `SMA60`、`SMA250` 保持区分度
  - [x] SubTask 3.3: 验证新增 `SMA20` 后 hover、十字光标、可见范围同步不回退

- [x] Task 4: 对标“大盘看板”增加主图指标控制项
  - [x] SubTask 4.1: 在图表顶部增加主图指标控制区，覆盖价格主线、`SMA20`、`SMA60`、`SMA250` 等主图信号
  - [x] SubTask 4.2: 实现主图指标的显示/隐藏切换，并保证切换不改变当前视窗与交互状态
  - [x] SubTask 4.3: 校验控制项文案、默认开关状态与布局密度，避免遮挡图表主体

- [x] Task 5: 对标“大盘看板”增加副图显示/隐藏开关
  - [x] SubTask 5.1: 为各副图提供独立开关，并明确默认显示策略
  - [x] SubTask 5.2: 实现副图隐藏时仅收起可见区域，不清空数据；重新开启时直接恢复显示
  - [x] SubTask 5.3: 验证副图开关后剩余图表的 hover、十字光标、日期与范围联动仍正常

- [x] Task 6: 回归验证与交付
  - [x] SubTask 6.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [x] SubTask 6.2: 验证搜索栏在首屏更醒目，且默认态、hover、focus 态反馈明确
  - [x] SubTask 6.3: 验证主图已新增 `SMA20`，且主图指标控制项可以正常切换各指标显示
  - [x] SubTask 6.4: 验证副图显示/隐藏开关行为与“大盘看板”一致，不出现空白、联动丢失或需重新查询的问题

- [x] Task 7: 排查“ETF自定义查询”X轴拖拽缩放失效的根因
  - [x] SubTask 7.1: 复核 `RpsCustomQueryCharts` 中 `visibleRangeRef`、`subscribeVisibleLogicalRangeChange`、初始化 range 与补偿回放逻辑
  - [x] SubTask 7.2: 明确是哪个 effect、同步守卫或回放逻辑在用户拖拽/缩放后覆盖了当前视窗
  - [x] SubTask 7.3: 对照“大盘看板”或其他稳定图表实现，确认应保留与应收敛的同步行为边界

- [x] Task 8: 修复X轴拖拽缩放与联动补偿的冲突
  - [x] SubTask 8.1: 调整初始化、联动同步或补偿回放逻辑，避免在非必要时重复调用 `setVisibleLogicalRange`
  - [x] SubTask 8.2: 保留副图开关后的补偿同步能力，但不得影响用户后续主动缩放与平移
  - [x] SubTask 8.3: 确保拖拽放大、缩小、左右平移以及滚轮缩放恢复正常，且不会引入新的 hover/联动回退

- [x] Task 9: 针对X轴交互回归进行专项验证
  - [x] SubTask 9.1: 运行直接相关检查，如前端 `lint`、`typecheck`、`build` 或等价验证
  - [x] SubTask 9.2: 验证主图与各可见副图的 X 轴拖拽缩放、平移、滚轮缩放都可正常生效
  - [x] SubTask 9.3: 验证在切换主图指标与显示/隐藏副图后，缩放能力仍保持正常

- [ ] Task 10: 排查“ETF自定义查询”默认聚焦最近12个月失效的根因
  - [ ] SubTask 10.1: 复核 `DEFAULT_WINDOW_BARS`、`buildDefaultLogicalRange()` 与初始化 `setVisibleLogicalRange()` 的执行条件
  - [ ] SubTask 10.2: 确认是初始窗口未正确计算，还是在首次加载后被其他联动/补偿逻辑覆盖
  - [ ] SubTask 10.3: 明确首次进入页、切换标的、重新查询三种场景下默认窗口应如何重置

- [ ] Task 11: 修复默认视窗未聚焦最近12个月的问题
  - [ ] SubTask 11.1: 调整初始化默认窗口逻辑，使图表首次有效渲染时稳定聚焦最近12个月
  - [ ] SubTask 11.2: 保证切换标的或重新查询成功后，默认窗口会按预期重置到最近12个月
  - [ ] SubTask 11.3: 保证修复后不会重新破坏用户主动缩放、平移和副图联动行为

- [ ] Task 12: 针对默认12个月窗口进行专项验证
  - [ ] SubTask 12.1: 运行直接相关检查，如前端 `lint`、`typecheck`、`build` 或等价验证
  - [ ] SubTask 12.2: 验证首次进入页默认显示最近12个月，而不是全历史
  - [ ] SubTask 12.3: 验证切换标的或重新查询后，默认窗口仍会重置为最近12个月

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1 and Task 3
- Task 5 depends on Task 1
- Task 6 depends on Task 2, Task 3, Task 4, and Task 5
- Task 8 depends on Task 7
- Task 9 depends on Task 8
- Task 11 depends on Task 10
- Task 12 depends on Task 11
