# Tasks

- [ ] Task 0: Supabase DDL（DBA 手动操作）
  - [ ] 0.1 `ALTER TABLE rps_style_point ADD COLUMN target_high_qfq numeric`
  - [ ] 0.2 `ALTER TABLE rps_style_point ADD COLUMN target_low_qfq numeric`
  - [ ] 0.3 两列均允许 NULL，后续回填

- [x] Task 1: 后端类型扩展
  - [x] 1.1 `server/lib/supabaseRest.ts`：`RpsStylePointRow` 新增 `target_high_qfq: number | null` 和 `target_low_qfq: number | null`
  - [x] 1.2 `server/lib/rpsStyle.ts`：`RpsComputedPoint` 新增 `targetHighQfq: number` 和 `targetLowQfq: number`
  - [x] 1.3 `server/lib/rpsStyle.ts`：`mapPointRowToComputedPoint` 映射新字段
  - [x] 1.4 `server/lib/rpsStyle.ts`：RPS 自定义查询 API 输出序列时透传 high/low 到前端

- [x] Task 2: refreshRpsStyleSnapshots.ts 写入 OHLC
  - [x] 2.1 获取 QFQ 日线时同时请求 high/low（东方财富 `fields2=f51,f52,f53,f54,f55`）
  - [x] 2.2 `targetHighQfq` / `targetLowQfq` 写入 Supabase（`target_high_qfq` / `target_low_qfq`）

- [x] Task 3: 前端 API 类型扩展
  - [x] 3.1 `src/utils/marketApi.ts`：`RpsStyleSeriesPoint` 新增 `targetHighQfq: number` 和 `targetLowQfq: number`

- [x] Task 4: 前端 ATR 改用真实 True Range
  - [x] 4.1 `src/components/charts/RpsCustomQueryCharts.tsx`：`PreparedPoint` 新增 `targetHighQfq: number` 和 `targetLowQfq: number`
  - [x] 4.2 prepared useMemo 中改为用 True Range 公式计算 ATR(14)：`TR = max(H-L, |H-prevC|, |L-prevC|)`
  - [x] 4.3 `buildV61MarkerDetails` 中 ATR 乘数恢复为 `3`，移除 `ATR_FRONTEND_MULTIPLIER`
  - [x] 4.4 ATR 提示文案恢复为「ATR-3x：跌幅超3倍ATR(14)」

- [x] Task 5: 前端信号快照 ATR 改用真实 True Range
  - [x] 5.1 `src/utils/momentumSignalSnapshot.ts`：`PreparedMomentumPoint` 新增 `targetHighQfq` / `targetLowQfq`
  - [x] 5.2 `prepareMomentumPoints` 中用 True Range 公式计算 ATR(14)
  - [x] 5.3 `buildBaselineEnhancedEvents` 中 ATR 乘数恢复为 `3`

- [x] Task 6: 方法论更新
  - [x] 6.1 `src/utils/baselineEnhancedMethodology.ts`：校准说明替换为真实 ATR(14) 定义

- [ ] Task 7: 全量回填与验证
  - [ ] 7.1 执行一次 `refreshRpsStyleSnapshots` 全量运行（从 2016-01-01）
  - [x] 7.2 前端 TypeScript 编译无错误
  - [ ] 7.3 以 159915 为例验证线上 ATR-3x 行为与回测一致

# Task Dependencies
- Task 0 (DBA) — **阻塞 Task 2, Task 7**，但不阻塞代码开发 Task 1~Task 6（已完成）
- Task 1 → Task 2（refresh 脚本需要新类型）
- Task 1, Task 3 → Task 4, Task 5（前端需要后端类型对齐）
- Task 5 automatically fixes ETF200 signal consistency（同一代码路径）
- Task 7 依赖于 Task 0 + Task 2 完成（需要 DB 列和后端写入）
