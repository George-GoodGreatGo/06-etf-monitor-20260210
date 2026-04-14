# Tasks
- [x] Task 1: 调整 GitHub Actions 为夜间全量回灌模式
  - [x] 将 schedule 固定在北京时间 20:00（UTC 12:00）并配置 concurrency（避免并发跑多次）
  - [x] 将默认执行模式切换为 backfill（近10年全量）
  - [x] 增加可选的手动参数：startDate/endDate（用于临时回灌或缩小范围）

- [x] Task 2: 回灌脚本支持“分段拉取 + 节流/退避”
  - [x] 将 10 年区间拆分为多个小区间（按年/季度或按固定交易日窗口）
  - [x] 对每个小区间顺序拉取与计算（host 级并发=1）
  - [x] 对 429/5xx/超时加入指数退避 + 抖动 + 最大重试次数
  - [x] 输出日志：每段区间的开始/结束、耗时、失败原因

- [x] Task 3: Supabase “完全覆写”写入策略
  - [x] 实现近10年范围内旧记录的废弃策略（删除范围后写入，或 upsert 后删除未覆盖日期）
  - [x] 分批 upsert（控制单次写入行数），确保不超出请求体限制
  - [x] 额外清理：删除 10 年窗口之外的历史行（如存在）

- [x] Task 4: 回归验证与防回归
  - [x] 运行一次 backfill（可用缩小范围验证），确认写入行数与日期不重复
  - [x] 验证节流/重试逻辑：模拟失败时不会写入推测值、日志可读
  - [x] `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
