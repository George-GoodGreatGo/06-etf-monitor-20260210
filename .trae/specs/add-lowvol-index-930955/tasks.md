# Tasks
- [x] Task 1: 服务端新增 930955 指数配置
  - [x] 在 server/lib/lowVol.ts 的 LOWVOL_INDEXES 中新增 930955 配置（name/priCode/triCode）
  - [x] TRI 数据缺失时允许降级返回（不阻断主图/BIAS 展示；股息率/利差相关指标与建议可能为 “—”）

- [x] Task 2: 前端指数切换新增 930955
  - [x] 在 Home 的 LOWVOL_INDEX_OPTIONS 增加“红利低波100（930955）”
  - [x] 确保点击后请求 `/api/lowvol/index/930955`（与其他指数同逻辑）

- [x] Task 3: 验证与回归
  - [x] 930955 支持 BIAS 基准切换（SMA250/SMA60）与其他指数一致
  - [x] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
