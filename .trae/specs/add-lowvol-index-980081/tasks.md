# Tasks
- [x] Task 1: 服务端新增 980081 指数配置
  - [x] 在 server/lib/lowVol.ts 的 LOWVOL_INDEXES 中新增 980081 配置（name/priCode/triCode=480081）
  - [x] 使用 cnindex 数据源（hq.cnindex.com.cn）拉取 PRI/TRI 日频数据并通过对齐校验（overlap >= 253）

- [x] Task 2: 前端指数切换新增 980081
  - [x] 在 Home 的 LOWVOL_INDEX_OPTIONS 增加“国证价值100（980081）”
  - [x] 确保点击后请求 `/api/lowvol/index/980081` 并正常渲染（图表、建议、BIAS 基准切换均生效）

- [x] Task 3: 验证与回归
  - [x] 切换到 980081：图表数据加载成功、建议与二级导航建议标签显示正常
  - [x] BIAS 基准切换（SMA250/SMA60）对 980081 同样生效
  - [x] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
