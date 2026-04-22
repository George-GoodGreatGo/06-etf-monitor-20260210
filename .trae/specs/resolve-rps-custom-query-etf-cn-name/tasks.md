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

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
