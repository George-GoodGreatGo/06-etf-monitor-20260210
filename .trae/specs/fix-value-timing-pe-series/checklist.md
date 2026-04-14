- [ ] 932315/932365 的 CSIndex indicator 解析产出“多年历史”PE 序列，`pe_points` 不再是个位数/几十条，且与收盘点位数量同量级。
- [ ] 指标解析支持 Excel 数字日期（序列号），不会因日期类型导致漏行。
- [ ] 980081 的 PE 不再出现 `0` 被当成有效值；`pe<=0` 被视为缺失并记录 `notes`。
- [ ] 980081 能获得可验证的估值来源（或明确降级），不会导致利差/分位“全空且无解释”。
- [ ] `refreshValueTimingSnapshots` 日志/notes 能定位 PE 来源与缺失原因（provider/字段/端点/错误摘要）。
- [ ] `npm run check` 与 `npm run test:unit` 通过。

