# Tasks
- [x] Task 1: 梳理自定义查询主图、成交金额追踪与搜索栏的现有实现入口
  - [x] SubTask 1.1: 确认主图价格线分段着色当前使用的 `RPS Score` 阈值与颜色映射
  - [x] SubTask 1.2: 确认主图放量圆点与“总览”“自定义查询”成交金额追踪放量高亮的样式复用入口
  - [x] SubTask 1.3: 确认顶部搜索输入框与查询按钮当前样式、文案与状态切换逻辑
  - [x] SubTask 1.4: 确认新增 `RSI(14)` 副图所需价格数据和图表联动接入点

- [x] Task 2: 调整自定义查询主图信号表达
  - [x] SubTask 2.1: 将主图价格线按 `RPS Score` 更新为 `<0` 绿色、`[0,10]` 黄色、`(10,20]` 橙色、`>20` 红色
  - [x] SubTask 2.2: 将主图放量标记更新为淡紫色圆点，并保证与日期对齐
  - [x] SubTask 2.3: 验证新的颜色分段不会破坏主图 hover、缩放和联动行为

- [x] Task 3: 统一成交金额追踪中的放量高亮配色
  - [x] SubTask 3.1: 将“总览”中的“成交金额追踪”放量高亮更新为淡紫色
  - [x] SubTask 3.2: 将“自定义查询”中的“成交金额追踪”放量高亮更新为淡紫色
  - [x] SubTask 3.3: 保证两处高亮颜色与主图放量圆点视觉一致

- [x] Task 4: 新增自定义查询页 RSI(14) 副图与超买超卖区域
  - [x] SubTask 4.1: 基于现有历史价格序列计算并渲染 `RSI(14)` 走势
  - [x] SubTask 4.2: 在副图中加入 `>70` 的红色超买背景区域与 `<30` 的绿色超卖背景区域
  - [x] SubTask 4.3: 保证新增副图纳入既有 hover 日期、十字光标和可见范围联动

- [x] Task 5: 强化顶部搜索栏视觉并精简按钮文案
  - [x] SubTask 5.1: 提升搜索栏默认态的边框、背景或阴影权重，让首屏入口更醒目
  - [x] SubTask 5.2: 将按钮文案从“提交查询”改为“查询”
  - [x] SubTask 5.3: 保证强化后的搜索栏与当前深色主题、状态栏和响应式布局保持协调

- [x] Task 6: 回归验证与交付
  - [x] SubTask 6.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [x] SubTask 6.2: 验证主图四档价格着色、淡紫色放量圆点和两处成交金额追踪淡紫色高亮全部生效
  - [x] SubTask 6.3: 验证 `RSI(14)` 副图、超买超卖区域以及图表联动行为正常
  - [x] SubTask 6.4: 验证搜索栏默认态更醒目且按钮文案已更新为“查询”

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 1
- Task 6 depends on Task 2, Task 3, Task 4, and Task 5
