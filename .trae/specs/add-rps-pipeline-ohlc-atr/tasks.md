# Tasks

- [ ] Task 0: Supabase DDL（DBA 手动操作）
  - [ ] 0.1 `ALTER TABLE rps_style_point ADD COLUMN target_high_qfq numeric`
  - [ ] 0.2 `ALTER TABLE rps_style_point ADD COLUMN target_low_qfq numeric`
  - [ ] 0.3 两列均允许 NULL，后续回填

- [ ] Task 1: 后端类型扩展
  - [ ] 1.1 `server/lib/supabaseRest.ts`：`RpsStylePointRow` 新增 `target_high_qfq: number | null` 和 `target_low_qfq: number | null`
  - [ ] 1.2 `server/lib/rpsStyle.ts`：`RpsComputedPoint` 新增 `targetHighQfq: number` 和 `targetLowQfq: number`
  - [ ] 1.3 `server/lib/rpsStyle.ts`：`mapPointRowToComputedPoint` 映射新字段
  - [ ] 1.4 `server/lib/rpsStyle.ts`：RPS 自定义查询 API 输出序列时透传 high/low 到前端

- [ ] Task 2: refreshRpsStyleSnapshots.ts 写入 OHLC
  - [ ] 2.1 获取 QFQ 日线时同时请求 high/low（东方财富 `fields2=f51,f52,f53,f54,f55`）
  - [ ] 2.2 `targetHighQfq` / `targetLowQfq` 写入 Supabase（`target_high_qfq` / `target_low_qfq`）

- [ ] Task 3: 前端 API 类型扩展
  - [ ] 3.1 `src/utils/marketApi.ts`：`RpsStyleSeriesPoint` 新增 `targetHighQfq: number` 和 `targetLowQfq: number`

- [ ] Task 4: 前端 ATR 改用真实 True Range
  - [ ] 4.1 `src/components/charts/RpsCustomQueryCharts.tsx`：`PreparedPoint` 新增 `targetHighQfq: number` 和 `targetLowQfq: number`
  - [ ] 4.2 prepared useMemo 中改为用 True Range 公式计算 ATR(14)：`TR = max(H-L, |H-prevC|, |L-prevC|)`
  - [ ] 4.3 `buildV61MarkerDetails` 中 ATR 乘数恢复为 `3`，移除 `ATR_FRONTEND_MULTIPLIER`
  - [ ] 4.4 ATR 提示文案从「已校准」改为正常描述

- [ ] Task 5: 前端信号快照 ATR 改用真实 True Range
  - [ ] 5.1 `src/utils/momentumSignalSnapshot.ts`：`PreparedMomentumPoint` 新增 `targetHighQfq` / `targetLowQfq`
  - [ ] 5.2 `prepareMomentumPoints` 中用 True Range 公式计算 ATR(14)
  - [ ] 5.3 `buildBaselineEnhancedEvents` 中 ATR 乘数恢复为 `3`

- [ ] Task 6: 方法论更新
  - [ ] 6.1 `src/utils/baselineEnhancedMethodology.ts`：移除校准说明，替换为真实 ATR(14) 定义

- [ ] Task 7: 全量回填与验证
  - [ ] 7.1 执行一次 `refreshRpsStyleSnapshots` 全量运行（从 2016-01-01）
  - [ ] 7.2 前端 TypeScript 编译无错误
  - [ ] 7.3 以 159915 为例验证线上 ATR-3x 行为与回测一致

# Task Dependencies
- Task 0 (DBA) — **阻塞 Task 2, Task 7**，但不阻塞代码开发 Task 1~Task 6
- Task 1 → Task 2（refresh 脚本需要新类型）
- Task 1, Task 3 → Task 4, Task 5（前端需要后端类型对齐）
- Task 5 automatically fixes ETF200 signal consistency（同一代码路径）
- Task 7 依赖于 Task 0 + Task 2 完成（需要 DB 列和后端写入）
