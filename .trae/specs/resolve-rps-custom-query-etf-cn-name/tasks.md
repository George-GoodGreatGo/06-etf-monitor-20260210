# Tasks
- [x] Task 1: 梳理自定义查询ETF名称的现状与可复用来源
  - [x] SubTask 1.1: 确认 `getCustomTickerProfile()` 当前对未知 ETF 的命名回退逻辑
  - [x] SubTask 1.2: 盘点项目内可复用的 ETF 中文名来源与优先级
  - [x] SubTask 1.3: 明确名称无法解析时的最小安全降级规则

- [x] Task 2: 补强RPS自定义查询的ETF名称解析
  - [x] SubTask 2.1: 保持已知 RPS 标的继续直接使用预置中文名
  - [x] SubTask 2.2: 为非预置 ETF 增加中文名称解析逻辑，避免直接返回 `ETF xxxxxx`
  - [x] SubTask 2.3: 确保接口返回的 `name` 在成功解析后稳定传递到前端

- [x] Task 3: 校对摘要区的名称展示一致性
  - [x] SubTask 3.1: 确认“当前标的”位置直接显示中文名称与代码
  - [x] SubTask 3.2: 确认图表说明等复用位置使用同一名称字段
  - [x] SubTask 3.3: 校对名称缺失时的降级展示不影响页面可读性

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 为名称解析补充针对性测试或等价验证
  - [x] SubTask 4.2: 运行直接相关检查并确认无新增报错
  - [x] SubTask 4.3: 验证截图所示位置对典型 ETF 可直接展示中文名称及代码

- [x] Task 5: 修复中文名称未生效的缓存链路问题
  - [x] SubTask 5.1: 查明“代码已输入但仍只显示代码”的具体根因，区分服务端结果缓存、前端缓存与元数据失败缓存
  - [x] SubTask 5.2: 调整自定义查询与名称映射缓存策略，避免旧的仅代码结果继续命中
  - [x] SubTask 5.3: 确保 ETF 元数据短暂失败不会被长时间缓存为空映射

- [x] Task 6: 重新验证名称修复在运行链路中真实生效
  - [x] SubTask 6.1: 使用典型非预置 ETF 验证接口返回已包含中文名称
  - [x] SubTask 6.2: 验证前端摘要区与图表说明位置同步显示中文名称及代码
  - [x] SubTask 6.3: 运行直接相关检查并确认无新增回归

- [x] Task 7: 建立本地页面级验证并定位残余显示问题
  - [x] SubTask 7.1: 在本地环境针对 `159209`、`159985` 等非预置 ETF 分别验证元数据源、解析函数与接口返回
  - [x] SubTask 7.2: 在本地页面中真实执行查询，确认“当前标的”与图表说明是否都显示中文名称及代码
  - [x] SubTask 7.3: 若接口正确但页面仍只显示代码，定位前端状态流、请求缓存、认证上下文或请求目标后端差异

- [x] Task 8: 修复本地页面展示与接口返回不一致的问题并回归
  - [x] SubTask 8.1: 采用最小改动修复本地页面仍只显示代码的问题
  - [x] SubTask 8.2: 通过本地页面复测确认代表性非预置 ETF 代码稳定显示中文名
  - [x] SubTask 8.3: 运行直接相关检查并记录本地验证结论

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2 and Task 3
- Task 6 depends on Task 5
- Task 7 depends on Task 5 and Task 6
- Task 8 depends on Task 7
