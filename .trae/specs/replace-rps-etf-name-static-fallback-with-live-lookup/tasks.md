# Tasks
- [x] Task 1: 明确实时中文名数据源与现有双轨逻辑边界
  - [x] SubTask 1.1: 确认当前本地与线上名称解析链路差异，明确哪些逻辑是 Python 专属、哪些逻辑是线上 fallback
  - [x] SubTask 1.2: 选定一个本地与线上都可访问、且不依赖 Python 的实时 HTTP 数据源
  - [x] SubTask 1.3: 明确实时名称源失败时的最小降级行为与错误边界

- [x] Task 2: 将非预置 ETF 名称主路径切换为实时 HTTP 查询
  - [x] SubTask 2.1: 服务端实现统一的 `code -> 中文名` 实时查询逻辑
  - [x] SubTask 2.2: 保持 RPS 预置名称优先，非预置 ETF 改走新的实时名称源
  - [x] SubTask 2.3: 移除或弱化静态名称快照作为线上主路径的角色，避免继续形成“电话本模式”

- [x] Task 3: 收敛前端自定义查询触发逻辑
  - [x] SubTask 3.1: 评估 `requestId` 当前的真实用途与是否可以改为更小的内部触发状态
  - [x] SubTask 3.2: 保证用户每次点击查询或重试，都会发起新的实时请求
  - [x] SubTask 3.3: 避免无业务含义的冗余请求参数，同时不破坏当前查询体验

- [x] Task 4: 严格回归验证
  - [x] SubTask 4.1: 为本地环境、模拟线上环境补充或更新针对性测试
  - [x] SubTask 4.2: 直接验证 `159209`、`159985` 等非预置 ETF 在接口层可返回中文名
  - [x] SubTask 4.3: 验证真实页面查询后，“当前标的”与图表说明位置都显示中文名称及代码
  - [x] SubTask 4.4: 运行直接相关检查，如 `check`、`lint`、`test:unit`

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
