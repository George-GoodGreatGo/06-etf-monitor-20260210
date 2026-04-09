# Tasks
- [x] Task 1: 找到 932365/932315 对应的 TRI code
  - [x] 调研 csindex 是否存在“全收益/净收益”版本的指数 code，并与 PRI 一一对应
  - [x] 用脚本验证 triCode 可通过现有 `index-perf` API 拉取到序列，且与 priCode 日期对齐

- [x] Task 2: 服务端补齐 TRI 映射并恢复指标输出
  - [x] 在 `server/lib/lowVol.ts` 的指数配置中补齐 triCode
  - [x] 调整计算：当 triCode 缺失/拉取失败/对齐不足时，抛出明确错误（不再静默返回 null 指标）
  - [x] 更新 `meta.notes`：写明 priCode/triCode 与口径

- [x] Task 3: 回归与验收
  - [x] 对 932365/932315 请求 API，确认 dividendYieldPct/spread*/spreadPctRank* 出现有效值（满足回溯窗口后）
  - [x] 非法或缺失 triCode 时返回可读错误
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
