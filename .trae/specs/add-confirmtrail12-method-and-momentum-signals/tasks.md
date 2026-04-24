# Tasks
- [x] Task 1: 梳理 `confirmTrail12` 页面化所需的信息结构与现有入口
  - [x] SubTask 1.1: 确认 `市场风格RPS` 下新增 `分析方法` 子页的导航位置、路由位置和面包屑口径
  - [x] SubTask 1.2: 确认 `动量分析` 页面当前简介区、主图 marker 数据流和交互入口，明确最小改动接入点
  - [x] SubTask 1.3: 明确 `confirmTrail12` 方法说明与 ETF 回测表格的数据来源，优先复用已有研究输出

- [x] Task 2: 新增 `分析方法` 页面并沉淀 `confirmTrail12` 方法说明
  - [x] SubTask 2.1: 新建 `分析方法` 页面容器、路由、导航和面包屑
  - [x] SubTask 2.2: 实现可读的策略说明内容，覆盖策略定位、指标定义、买入规则、卖出规则、增强风控、边界条件和实现口径
  - [x] SubTask 2.3: 在页面中加入本次样本 ETF 的 `confirmTrail12` 回测结果表格，保证字段完整且便于后续 PRD 复用

- [x] Task 3: 将 `confirmTrail12` 应用到 `动量分析` 主图默认买卖点
  - [x] SubTask 3.1: 将主图买点口径保持为 `绿转黄且收盘价>=SMA250`
  - [x] SubTask 3.2: 将主图卖点口径更新为 `黄转绿 + close<SMA20 / MACD Hist<0 / RSI<50 任一`
  - [x] SubTask 3.3: 增加 `持仓后相对高点回撤12%` 的增强风控卖点，并与确认卖点在展示或说明上可区分

- [x] Task 4: 在 `动量分析` 页面补充简介与方法跳转
  - [x] SubTask 4.1: 增加简要策略说明，明确默认规则已采用 `confirmTrail12`
  - [x] SubTask 4.2: 增加跳转到 `分析方法` 页的超链接入口
  - [x] SubTask 4.3: 保证简介文案与详细方法页口径一致但不过度重复

- [x] Task 5: 支持主图买卖点点击弹窗说明
  - [x] SubTask 5.1: 为主图买卖点 marker 补充可点击交互和选中态
  - [x] SubTask 5.2: 点击买点时展示买入原因说明
  - [x] SubTask 5.3: 点击确认卖点或风控卖点时展示对应触发原因说明
  - [x] SubTask 5.4: 保证弹窗不破坏现有 hover、缩放、十字光标和多图联动

- [ ] Task 6: 回归验证页面、信号和交互
  - [ ] SubTask 6.1: 验证 `市场风格RPS > 分析方法` 页面可进入，导航与面包屑正确
  - [ ] SubTask 6.2: 验证 `动量分析` 页面默认买卖点已切换为 `confirmTrail12`
  - [ ] SubTask 6.3: 验证点击买卖点后弹窗说明与实际触发条件一致
  - [ ] SubTask 6.4: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证，确认未引入明显回归

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 3
- Task 6 depends on Task 2, Task 4 and Task 5
