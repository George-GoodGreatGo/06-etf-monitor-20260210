# Checklist

- [ ] Supabase `rps_style_point` 表存在 `target_high_qfq` 和 `target_low_qfq` 列
- [ ] `RpsStylePointRow` 类型包含 `target_high_qfq` / `target_low_qfq` 字段
- [ ] `RpsComputedPoint` 类型包含 `targetHighQfq` / `targetLowQfq` 字段
- [ ] `refreshRpsStyleSnapshots` 写入时透传 high/low 值
- [ ] `RpsStyleSeriesPoint` 前端类型包含 `targetHighQfq` / `targetLowQfq` 字段
- [ ] API `/api/rps/custom-query` 响应中包含 high/low 字段
- [ ] `PreparedPoint` 包含 `targetHighQfq` / `targetLowQfq`
- [ ] `PreparedMomentumPoint` 包含 `targetHighQfq` / `targetLowQfq`
- [ ] 前端 ATR(14) 基于真实 True Range 公式计算：`max(H-L, |H-prevC|, |L-prevC|)`
- [ ] `buildV61MarkerDetails` 中 ATR 乘数为 `3`（恢复回测值）
- [ ] `buildBaselineEnhancedEvents` 中 ATR 乘数为 `3`
- [ ] `ATR_FRONTEND_MULTIPLIER` 已移除
- [ ] 方法论文件中校准说明已替换为真实 ATR 定义
- [ ] `npx tsc --noEmit` 编译无错误
- [ ] 以 159915 为例，「动量分析」图表上的 ATR-3x 风控卖不再过频触发
- [ ] 「ETF200列表」中 Baseline加强风控策略的信号与「动量分析」图表一致
- [ ] 全量回填后 `rps_style_point` 表所有有效行 high/low 非 NULL
