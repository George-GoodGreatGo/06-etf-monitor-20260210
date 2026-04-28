- [x] ETF200 快照脚本与动量分析查询链路共用同一套信号序列构建入口
- [x] `H30269` 统一从稳定发布序列读取，而不是在列表快照与页面查询中分别使用不同实时基准
- [x] ETF200 快照只按各行 `latestTradingDate` 作为截止日计算当前信号，不混入更晚数据
- [x] 同一 ETF、同一策略、同一完整交易日下，ETF200 列表与动量分析页展示的 `signalKey`、`signalDate`、`freshnessBucket` 一致
- [x] `Baseline策略` 与 `baseColorFlip` 都通过共享入口计算，不残留平行旧逻辑
- [x] 稳定基准缺失或序列不完整时，系统不会静默回退到另一套实时口径并继续发布
- [x] 可通过指定 ticker 的调试开关输出 `referenceDate`、序列尾部与最终快照，用于核对环境差异
- [x] `513690` 在统一口径后，ETF200 列表与动量分析页的最近有效 `买` 信号日期一致，不再出现 `4/13` 与 `4/24` 漂移
- [x] 相关自动化验证通过，包括共享信号序列测试、敏感样本回归、类型检查、构建和必要的浏览器验证
- [x] 发布后可通过 Supabase 原始快照和页面展示双向核对统一结果

## 验证记录
- [x] `npm run check`
- [x] `npx tsx server/tests/top200MomentumSignals.test.ts`
- [x] `npx tsx server/tests/rpsSignalAlignment.test.ts`
- [x] `npm run test:unit`
- [x] `npm run build`
- [x] 本地 mock 页浏览器回归通过：`Baseline策略 + 风控卖`，以及 `基础颜色切换 + 买 + 当天 + |Z|>=2.58`
- [x] 浏览器 console 无新增应用 error；仅见 React DevTools 提示、既有 `boot-guard` warn 与一次 Vite dev server 重连提示
