# Tasks
- [ ] Task 1: 明确市场风格RPS二级页面的信息架构与状态切换方案
  - [ ] SubTask 1.1: 梳理当前“市场风格RPS”页面中哪些内容归入 `总览`，哪些内容归入 `自定义查询`
  - [ ] SubTask 1.2: 确定左侧二级菜单、页面默认落点、URL/状态参数与页面标题的映射关系
  - [ ] SubTask 1.3: 明确面包屑导航在两个页面中的展示文案与返回行为

- [ ] Task 2: 调整左侧导航与市场风格RPS页面容器结构
  - [ ] SubTask 2.1: 在左侧“市场风格RPS”下新增 `总览`、`自定义查询` 二级菜单
  - [ ] SubTask 2.2: 让页面容器支持按二级菜单切换内容，并保证默认进入 `总览`
  - [ ] SubTask 2.3: 校对当前页高亮、返回路径和刷新后落点行为稳定

- [ ] Task 3: 拆分总览页与自定义查询页内容
  - [ ] SubTask 3.1: 将 `Score截面数据`、`动量趋势`、`成交金额追踪` 收敛到 `总览` 页
  - [ ] SubTask 3.2: 将现有“自定义查询”全部内容迁移到独立的 `自定义查询` 页面
  - [ ] SubTask 3.3: 确保迁移后原有指标口径、三图联动、成交额追踪和异常状态行为保持一致

- [ ] Task 4: 为两个页面增加面包屑导航
  - [ ] SubTask 4.1: 在 `总览` 页顶部展示页面层级面包屑
  - [ ] SubTask 4.2: 在 `自定义查询` 页顶部展示页面层级面包屑
  - [ ] SubTask 4.3: 验证通过面包屑返回“市场风格RPS”上级层级或切换页面的交互清晰可用

- [ ] Task 5: 回归验证与交付
  - [ ] SubTask 5.1: 运行前端检查（如 `lint`、`typecheck`）并修复直接相关问题
  - [ ] SubTask 5.2: 验证左侧二级菜单、总览页三模块、自定义查询独立页、面包屑导航与页面切换符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3, and Task 4
