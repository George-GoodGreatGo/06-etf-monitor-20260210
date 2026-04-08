- [ ] 后端输出包含：spreadRawPct、spreadSmoothPct（EWMA半衰期126）、spreadPctRank10y（raw、窗口2520、min252）
- [ ] 缺失规则正确：raw 缺失时 smooth 与分位按 spec 输出 null 且不推进状态
- [ ] 前端可切换查看：利差（平滑）与利差分位(10年)，且文案标注口径清晰
- [ ] `npm run check` 与 `npm run lint` 无新增 error

