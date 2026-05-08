# Tasks
- [x] Task 1: 服务端新增 932422 指数配置
  - [x] 在 `server/lib/lowVol.ts` 的 `LOWVOL_INDEXES` 中新增 932422 配置（code='932422' / name='A500红利低波' / priCode='932422' / triCode='932422CNY010' / dataSource 默认 csindex）
  - [x] 确认 csindex 的 `index-perf` 接口能正常拉取 932422 的 PRI 和 932422CNY010 的 TRI 日频数据

- [x] Task 2: 前端指数切换新增 932422
  - [x] 在 `src/pages/Home.tsx` 的 `LOWVOL_INDEX_OPTIONS` 增加 `{ code: '932422', label: 'A500红利低波', desc: '...' }`（desc ≤100字的编制原则简介）
  - [x] 确保点击后请求 `/api/lowvol/index/932422` 并正常渲染（图表、建议、BIAS 基准切换均生效）

- [x] Task 3: 验证与回归
  - [x] 切换到 932422：图表数据加载成功、指标字段非全空、建议与二级导航建议标签显示正常
  - [x] BIAS 基准切换（SMA250/SMA60）对 932422 同样生效
  - [x] 回归验证既有指数（H30269/932365/932315/930955/980081 等）功能不受影响

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1, Task 2
