# Tasks
- [x] Task 1: 梳理并抽出“原始点位拉取”能力
  - [x] 在服务端提供可复用的 PRI/TRI close 序列拉取函数（csindex/cnindex），支持传入 `indexCode + startDate8 + endDate8`
  - [x] 保持现有 WAF 识别与熔断策略一致（WAF 直接失败，不重试）

- [x] Task 2: 实现增量计算（方案 B）
  - [x] 夜间脚本读取 Supabase 最新快照（service role 可读），解析历史 `payload.series`
  - [x] 计算增量拉取窗口：
    - PRI：`[lastDataDate-5天, endDate]`
    - TRI：覆盖 `lookbackDays=252` 与 `bufferDays=5` 的回溯区间（额外加 60 天缓冲）
  - [x] 合并增量点位到历史 close/TRI 数据结构
  - [x] 仅对尾部需要更新的交易日重新计算指标，并合并写回历史 series
  - [x] 写回 Supabase：upsert `code + data_date(最新交易日)`，payload 为合并后的完整 series

- [x] Task 3: 冷启动保持（N=10年）
  - [x] 无快照/快照不可用：拉取 10 年 PRI/TRI 并计算全量 series 写回
  - [x] 冷启动与增量计算共用同一套计算函数，避免口径漂移

- [x] Task 4: 日志与可观测
  - [x] 逐指数输出：模式（cold_start / incremental_compute）、priRange/triRange、写回 data_date、seriesLen、耗时
  - [x] 对齐失败时输出 priLen/triLen/overlap/lastDate 信息（便于判断是数据缺失还是接口软限制）

- [x] Task 5: 回归与验收
  - [x] 在“已有快照”的情况下，夜间增量刷新不再触发 `overlap < 253` 的必然失败
  - [x] 在“无快照”的情况下，冷启动可写入首份快照
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2-3
- Task 5 depends on Task 1-4
