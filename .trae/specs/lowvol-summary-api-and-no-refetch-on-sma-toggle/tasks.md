# Tasks
- [x] Task 1: 后端新增 lowvol summary 接口
  - [x] 在 `server/lib/lowVol.ts` 增加“按指数返回 latest 摘要”的函数（含 per-index 错误隔离）
  - [x] 增加 summary 结果缓存（TTL）与 in-flight 去重
  - [x] 在 `server/routes/lowVol.ts` 新增 `GET /summary` 并返回标准结构

- [x] Task 2: 前端接入 summary 并替换二级导航多请求
  - [x] 在 `src/utils/marketApi.ts` 增加 `fetchLowVolSummary`
  - [x] 在 `Home` 的 lowvol tab 中，使用 summary 一次性填充每个指数的 latest 数据
  - [x] 在 SMA250/SMA60 切换时，不再触发 summary/index 请求，仅基于缓存 latest 重算建议

- [ ] Task 3: 回归与验证
  - [ ] 进入低波 tab 时仅产生 1 次 summary 请求（不再对每个指数调用全量 index 接口）
  - [ ] 切换 SMA250/SMA60 时网络请求数不增加，且二级导航建议即时更新
  - [ ] 任一指数 latest 失败时，不影响其它指数显示（失败指数显示 “—”）
  - [ ] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
