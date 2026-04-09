# Tasks
- [x] Task 1: 确认指数 code 与全收益序列映射
  - [x] 确认 csindex 是否支持 932365、932315 的点位序列拉取
  - [x] 为每个指数确定（或补齐）价格指数 code 与全收益指数 code 的映射（用于股息率/核心利差口径）
  - [x] 记录映射与口径说明到服务端 `meta.notes`

- [x] Task 2: 后端支持按指数 code 计算并提供 API
  - [x] 将 `getLowVolH30269Series` 泛化为可接收指数配置的实现（白名单 + code->配置）
  - [x] 新增或扩展路由：按 code 获取低波序列（保持旧 `/api/lowvol/h30269` 兼容）
  - [x] 非法 code 返回 400（带可读 message）

- [x] Task 3: 前端增加指数选择器并切换数据源
  - [x] 在低波机会面板 header 区新增标签选择器（3 个选项，默认 H30269）
  - [x] `marketApi` 增加按 code 拉取的函数（或在现有函数上加参数）并更新类型命名（尽量最小改动）
  - [x] 切换时触发重新加载并复用现有图表组件展示
  - [x] 右侧摘要卡/说明文案显示当前指数名称与 code

- [x] Task 4: 验证与回归
  - [x] `npm run check` 通过
  - [x] 手动验证：三种指数均可切换加载，loading/error 状态正常；hover/建议/分段着色不报错

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 1-3
