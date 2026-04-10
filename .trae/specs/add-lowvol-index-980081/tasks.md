# Tasks
- [ ] Task 1: 服务端新增 980081 指数配置
  - [ ] 在 server/lib/lowVol.ts 的 LOWVOL_INDEXES 中新增 980081 配置（name/priCode/triCode=480081）
  - [ ] 验证 triCode 可用且与 priCode 可对齐（参考既有校验逻辑：overlap >= 253）

- [ ] Task 2: 前端指数切换新增 980081
  - [ ] 在 Home 的 LOWVOL_INDEX_OPTIONS 增加“国证价值100（980081）”
  - [ ] 确保点击后请求 `/api/lowvol/index/980081` 并正常渲染（图表、建议、BIAS 基准切换均生效）

- [ ] Task 3: 验证与回归
  - [ ] 切换到 980081：图表数据加载成功、建议与二级导航建议标签显示正常
  - [ ] BIAS 基准切换（SMA250/SMA60）对 980081 同样生效
  - [ ] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2

