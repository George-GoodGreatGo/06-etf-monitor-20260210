# Tasks
- [x] Task 1: 增强 10Y 国债收益率拉取的健壮性
  - [x] SubTask 1.1: 为年度下载请求增加超时、重试与退避策略；识别“HTTP 200 但返回 HTML 错误页”的情况并触发重试
  - [x] SubTask 1.2: 将“年度拉取失败”降级为“该年份缺失”，并将缺失信息写入 `notes`

- [x] Task 2: 增强 980081 ETF 推算口径的健壮性
  - [x] SubTask 2.1: ETF 估值拉取增加超时、重试与退避；失败降级为 `pe=null` 并记录 `notes`
  - [x] SubTask 2.2: 工作流增加网络兼容配置（例如 `NODE_OPTIONS=--dns-result-order=ipv4first`）

- [x] Task 3: 刷新脚本支持“部分成功”
  - [x] SubTask 3.1: 刷新脚本对单指数失败不抛出终止错误，记录失败列表并继续执行下一指数
  - [x] SubTask 3.2: 若至少一个指数成功写入，则 exit code=0；否则 exit code!=0
  - [x] SubTask 3.3: 输出结构化日志事件：`value_timing.refresh.partial_fail`（含失败 code 与原因摘要）

- [x] Task 4: 验证与回归
  - [x] SubTask 4.1: 增加单元测试/脚本验证：模拟 10Y 拉取失败与 ETF 拉取失败，确认不会导致整次脚本崩溃且能产生预期日志
  - [x] SubTask 4.2: 本地跑通 `npx tsx server/scripts/refreshValueTimingSnapshots.ts`（可用 mock 环境或跳过写库），保证类型检查与测试通过

# Task Dependencies
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 1, Task 2 and Task 3
