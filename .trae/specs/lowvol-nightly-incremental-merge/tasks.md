# Tasks
- [x] Task 1: 补齐增量刷新脚本能力
  - [x] 读取 Supabase 最新快照（按 code），获得 `data_date` 与 `payload.series`（GitHub Actions 环境仅提供 service role key 时也可读取）
  - [x] 有快照：将 `lastDataDate(YYYY-MM-DD)` 转为 `YYYYMMDD` 后计算增量窗口 `start=max(lastDataDate-5天, 10年前01-01)`，拉取并计算增量数据
  - [x] 将“历史 series + 增量 series”按 date 去重合并（同 date 以增量覆盖），按 date 升序排序
  - [x] 写回 Supabase（upsert `code + data_date(合并后序列最后一个交易日)`），payload 存合并后的完整 `series`

- [x] Task 2: 冷启动拉取（N=10年）
  - [x] 无快照：以 `[10年前01-01, endDate]` 拉取并写入首份快照
  - [x] 快照存在但 payload 异常时按“无快照”处理，避免丢数据

- [x] Task 3: 风控友好策略保持一致
  - [x] 继续串行队列、抖动等待
  - [x] 非 WAF 失败最多重试 1 次（退避 + 抖动）
  - [x] WAF/熔断触发则终止本轮任务（避免越拉越封）
  - [x] 日志保持“逐指数可观察”输出

- [x] Task 4: 回归与验收
  - [x] 本地用 `LOWVOL_REFRESH_IGNORE_WINDOW=1` 运行脚本：有快照与无快照两种路径都能跑通
  - [x] 合并逻辑不丢历史：增量写入后 series 长度不应明显变短
  - [x] Actions 环境（仅提供 `SUPABASE_SERVICE_ROLE_KEY`）可读取最新快照并完成增量合并
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
- Task 4 depends on Task 1-3
