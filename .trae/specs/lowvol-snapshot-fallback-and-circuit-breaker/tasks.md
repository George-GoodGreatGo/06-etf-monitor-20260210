# Tasks
- [x] Task 1: 低波指数快照表与读写封装（Supabase）
  - [x] 在 `server/lib/supabaseRest.ts` 增加 lowvol 快照表的读写封装（按 code 读最新；按 code+dataDate upsert）
  - [x] 定义快照 payload（存低波计算后的完整 payload：`data.series`）

- [x] Task 2: 定时队列刷新（20:00–22:00 北京时间）
  - [x] 新增“刷新任务入口”（脚本：`server/scripts/refreshLowVolSnapshots.ts`，可被外部定时调用）
  - [x] 队列化刷新所有低波支持指数：并发=1，每个指数失败最多重试 1 次（退避+抖动）
  - [x] 若识别到 WAF，触发熔断并提前终止本轮刷新（避免越拉越封）

- [x] Task 3: WAF 熔断 + 限流策略（仅对回源链路生效）
  - [x] 在 `server/lib/lowVol.ts` 识别 WAF 拦截错误并设置 cooldown（含 cooldownUntil）
  - [x] 冷却期内跳过 csindex 请求；定时任务与强制回源均受其约束
  - [x] 加入 in-flight 去重（同一 code/range 复用）

- [x] Task 4: 用户访问默认读快照
  - [x] `/api/lowvol/index/:code`：默认优先读 Supabase 最新快照；快照缺失时返回明确错误（不推测）
  - [x] `/api/lowvol/summary`：从各 code 的最新快照聚合 latest；缺失则该项为 null 并带 message
  - [x] 补齐 meta（sourceType/snapshotAt/stale/cooldownUntil）

- [x] Task 5: 前端提示（最小改动）
  - [x] 在低波机会页面展示“快照数据（非最新）/快照时间”的提示（基于 meta）

- [x] Task 6: 验证与回归
  - [x] 刷新任务在窗口内可运行：写入 Supabase；失败按策略重试；遇 WAF 进入冷却并停止
  - [x] 用户访问不触发 csindex 回源（只读 Supabase）
  - [x] 快照缺失时提示“暂无快照/等待晚间刷新”，不展示推测值
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
- Task 4 depends on Task 1-3
- Task 5 depends on Task 4
- Task 6 depends on Task 1-5
