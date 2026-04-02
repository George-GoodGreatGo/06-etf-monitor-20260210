# Tasks

- [x] Task 1: 梳理大盘看板“数据状态栏”位置与数据流
  - [x] 找到表格视图/看板页面中状态栏 UI 组件与渲染位置
  - [x] 明确当前数据请求返回的 `meta` 字段在前端的传递路径

- [x] Task 2: 前端状态栏展示数据来源与数据日期
  - [x] 将 `meta.source/meta.dataDate` 映射为可读标签（主源/替代源/快照）
  - [x] 若为快照，显示“非实时”标识
  - [x] 确保与现有 AI 解读顶部来源提示不冲突（可复用同一套标签逻辑）

- [x] Task 3: 复核成交额单位与表格标题一致
  - [x] 核对后端成交额换算口径（Eastmoney kline amount → 千元）
  - [x] 核对表格标题单位与实际展示值一致（必要时调整标题或换算）
  - [x] 在 `meta.notes` 中写明来源字段与换算关系

- [x] Task 4: 复核北向资金净流入口径与单位
  - [x] 确认北向数据源字段（Eastmoney Datacenter `NET_INFLOW_BOTH`）
  - [x] 从数据源页面/接口字段说明中确认单位口径（按接口字段量纲展示，不做推测换算）
  - [x] 调整表格标题/格式化，使单位与口径一致
  - [x] 在 `meta.notes` 中写明字段名与单位口径

- [x] Task 5: 回归与验收
  - [x] 表格视图状态栏可见：来源、日期、快照非实时标识
  - [x] 成交额与北向资金单位与数值一致，无误导
  - [x] `npm run check` 与 `npm run lint` 无新增 error

# Task Dependencies
- Task 2 depends on Task 1
- Task 5 depends on Task 2, Task 3, Task 4
