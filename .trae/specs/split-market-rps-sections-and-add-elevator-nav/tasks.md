# Tasks
- [x] Task 1: 梳理 RPS 页面三分区与全站悬浮导航的需求边界
  - [x] SubTask 1.1: 明确现有 RPS 内容中哪些部分归入 `Score 截面数据`、`动量趋势`、`成交金额追踪` 三个模块
  - [x] SubTask 1.2: 为三个模块定义稳定锚点，并明确悬浮导航所需的配置结构
  - [x] SubTask 1.3: 明确“电梯导航 + 返回顶部”整合后的通用交互规则与复用边界

- [x] Task 2: 抽取全站复用的悬浮导航组件
  - [x] SubTask 2.1: 新增通用悬浮导航组件容器，支持模块跳转入口与返回顶部入口
  - [x] SubTask 2.2: 组件支持通过配置传入模块列表，不绑定单一业务页面
  - [x] SubTask 2.3: 为组件补充当前模块高亮、回顶行为与基础样式规则

- [x] Task 3: 重构 RPS 页面为三个顺序模块并接入悬浮导航
  - [x] SubTask 3.1: 将页面内容按 `Score 截面数据`、`动量趋势`、`成交金额追踪` 顺序拆分为独立区块
  - [x] SubTask 3.2: 为每个模块补充统一标题、容器边界与锚点，并接入通用悬浮导航组件
  - [x] SubTask 3.3: 校对原有数据口径、默认状态与交互在重排后保持不变

- [x] Task 4: 优化滚动定位与可用性表现
  - [x] SubTask 4.1: 处理悬浮导航在不同滚动位置下的可见性、遮挡与点击可用性
  - [x] SubTask 4.2: 校对模块跳转与返回顶部后的落点位置，避免标题被顶部区域遮挡
  - [x] SubTask 4.3: 验证三个模块与悬浮导航在不同屏宽下的阅读顺序与布局稳定性

- [x] Task 5: 回归验证与交付
  - [x] SubTask 5.1: 运行前端检查（如 lint/typecheck）并修复直接相关问题
  - [x] SubTask 5.2: 验证三模块顺序、悬浮导航跳转、返回顶部、当前态高亮与原有 RPS 数据展示符合 spec

- [x] Task 6: 修复前端检查失败并完成交付收口
  - [x] SubTask 6.1: 修复 `server/lib/marketLiquidityV5Service.ts` 中 `no-extra-boolean-cast` 的 lint 报错
  - [x] SubTask 6.2: 修复 `server/lib/valueTiming.ts` 中未使用变量 `ymd10MinusDays` 的 lint 报错
  - [x] SubTask 6.3: 复跑 `npm run lint` 并在通过后回勾 checklist 最后一项与 Task 5

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3, and Task 4
- Task 6 depends on Task 5
