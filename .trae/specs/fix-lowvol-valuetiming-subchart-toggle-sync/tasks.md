# Tasks
- [x] Task 1: 基于大盘看板实现复盘低波/价值联动链路，明确最小改动点
  - [x] 对比 `LowVolOpportunityChart` 与 `MarketLiquidityChart` 的数据回灌、crosshair/range 同步实现
  - [x] 明确副图开关后“无数据/失联/TIPS卡死”的可复现代码路径

- [x] Task 2: 修复低波/价值副图开关后的数据回灌稳定性
  - [x] 在 `LowVolOpportunityChart` 中补齐副图对象调用的实例存在性保护
  - [x] 确保副图关闭写空、开启回灌的执行不被单点调用异常中断
  - [x] 确保副图重开后可见范围与主图保持一致

- [x] Task 3: 修复联动临界区，避免 hover/TIPS 永久失效
  - [x] 将可见范围同步与 crosshair 同步临界区改为可恢复模式（异常后必复位）
  - [x] 对 `setCrosshairPosition` 增加目标实例与数值有效性检查
  - [x] 在副图集合变化时执行必要的联动状态清理与重同步

- [x] Task 4: 复核价值择时映射链路并做最小防御
  - [x] 校验 `ValueTimingChart` 到 `LowVolOpportunityChart` 的字段映射完整性
  - [x] 对空值边界做最小兜底，不改变指标业务语义

- [x] Task 5: 同步复核大盘看板同类临界区（仅必要最小修补）
  - [x] 检查 `MarketLiquidityChart` 是否存在同类同步状态遗留风险
  - [x] 若存在，按同模式最小修补，保持现有交互行为

- [x] Task 6: 回归验证与交付确认
  - [x] 执行手工用例：低波/价值副图各项反复关开（至少2轮）并验证联动/TIPS
  - [x] 执行 `npm run lint` 与 `npm run check`
  - [x] 记录修复结果与残余风险（如无则明确“无残余阻塞项”）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2-3
- Task 5 can run in parallel with Task 4
- Task 6 depends on Task 2-5

## 回归修复批次（首次重开仍缺数）
- [x] Task 7: 定位“首次关闭再开启无数据、二次开关恢复”的精确时序触发点
  - [x] 对比低波/价值与大盘在“显示开关后首帧”的范围同步与数据回灌执行顺序
  - [x] 明确是 range 不可用、尺寸未稳定，还是首轮回灌被跳过导致

- [x] Task 8: 实现首次重开的补偿同步机制（低波/价值）
  - [x] 在副图从隐藏转显示后，增加一次尺寸稳定后的延迟同步重放
  - [x] 若首轮 `visibleLogicalRange` 不可用，增加可恢复回退路径（下一帧或可用时重试）
  - [x] 保证不引入重复订阅、循环同步或抖动

- [x] Task 9: 对照大盘看板补齐同等保护（仅必要最小）
  - [x] 复核 `MarketLiquidityChart` 对应首轮开关路径是否已有同等补偿
  - [x] 如缺失则补齐最小防护；如已具备则记录对照结论

- [x] Task 10: 回归验证并更新勾选
  - [x] 执行“首次关开即恢复”专项用例（低波+价值至少各2轮）
  - [x] 执行 `npm run lint` 与 `npm run check`
  - [x] 更新 checklist 本批次检查项并记录残余风险

## 回归批次依赖
- Task 8 depends on Task 7
- Task 9 can run in parallel with Task 8
- Task 10 depends on Task 8-9
