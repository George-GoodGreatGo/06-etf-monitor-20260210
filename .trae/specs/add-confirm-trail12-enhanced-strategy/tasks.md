# Tasks

- [ ] Task 1: 新建 `src/utils/confirmTrail12EnhancedMethodology.ts` 方法论文件
  - [ ] 导出 `CONFIRM_TRAIL12_ENHANCED_SUMMARY_LINES`（策略简述 3 条）
  - [ ] 导出 `CONFIRM_TRAIL12_ENHANCED_METHOD_SECTIONS`（策略定位、指标定义、买入规则、卖出规则-四项、增强风控、边界条件、实现口径七章）
  - [ ] 导出 `CONFIRM_TRAIL12_ENHANCED_BACKTEST_SOURCE`（数据来源说明）
  - [ ] 导出 `CONFIRM_TRAIL12_ENHANCED_BACKTEST_AGGREGATE`（汇总回测数据：收 104.96%、CAGR 12.57%、回撤 17.53%、交易 13.8、胜率 52.2%、持日 18.4、持仓 15.6%）
  - [ ] 导出 `CONFIRM_TRAIL12_ENHANCED_BACKTEST_ROWS`（5 ETF 逐行回测数据：创业板 162.4%/10.18%/14.2%、科创50 59.2%/9.24%/18.7%、科创创业 132.9%/19.94%/16.9%、半导体 43.2%/5.56%/21.6%、游戏 127.0%/17.92%/16.2%）

- [ ] Task 2: 修改 `src/utils/momentumStrategies.ts` 注册新策略
  - [ ] 新增 `MomentumStrategyId` 类型 `'confirmTrail12Enhanced'`
  - [ ] 新增 `MomentumStrategySignalPreset` 类型 `'confirmTrail12Enhanced'`
  - [ ] 修改 `DEFAULT_MOMENTUM_STRATEGY_ID` 为 `'confirmTrail12Enhanced'`
  - [ ] 修改 `isMomentumStrategyId()` 校验
  - [ ] 在 `MOMENTUM_STRATEGIES` 数组中新增第三个策略项，id=`confirmTrail12Enhanced`，label="Baseline增强风控"

- [ ] Task 3: 修改 `src/utils/momentumSignalSnapshot.ts` 新增信号计算
  - [ ] 新增 `buildConfirmTrail12EnhancedEvents()` 函数，实现 V6.1 信号逻辑（硬止损-7%、ATR-3x、10日冷却、分级追踪-8%）
  - [ ] 修改 `buildTradeSignalEvents()` 分发函数，新增 `'confirmTrail12Enhanced'` 分支

- [ ] Task 4: 修改 `src/components/charts/RpsCustomQueryCharts.tsx` 图表信号
  - [ ] 新增或扩展 `buildConfirmTrail12EnhancedMarkerDetails()` 图表标记函数
  - [ ] 修改 `buildTradeSignalMarkerDetails()` 分发函数，新增 `'confirmTrail12Enhanced'` 分支

- [ ] Task 5: 回归验证
  - [ ] 确认动量分析页（`/market/rps/custom-query`）策略选择器默认选中"Baseline增强风控"
  - [ ] 确认图表上 买/卖/风控卖 信号正确渲染
  - [ ] 确认分析方法页（`/market/rps/methodology?strategy=confirmTrail12Enhanced`）展示完整方法论和回测数据
  - [ ] 确认 ETF200 列表页策略筛选器默认选中"Baseline增强风控"
  - [ ] 确认 ETF200 列表信号列展示买/卖/风控卖及新鲜度
  - [ ] 确认切换回"Baseline策略"时，策略选择器、信号、方法论页均正确退回到原版逻辑
  - [ ] 确认 V5.1 策略代码未保留对应方法论文档的 entry，保持干净（已移除的早期实验策略不应在前端可见）

# Task Dependencies
- Task 1 无依赖，可先行
- Task 2 依赖 Task 1（引用方法论常量）
- Task 3、Task 4 依赖 Task 2（需新的 Strategy 类型定义）
- Task 5 依赖 Task 1~4 全部完成
