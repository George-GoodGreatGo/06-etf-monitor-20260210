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

## 第三批回归修复（奇偶次开关交替失败）
- [x] Task 11: 定位“第一轮失败、第二轮成功、第三轮失败”交替模式的状态残留根因
  - [x] 排查补偿队列（raf/replay）是否在补偿完成后被完整清理
  - [x] 排查 `prevPaneVisible` 快照是否在每轮开关后正确更新
  - [x] 排查 `syncing`/range 缓存是否存在跨轮复用

- [x] Task 12: 修复补偿生命周期隔离，确保每轮开关独立执行
  - [x] 对补偿任务队列建立“入队-执行-清理”闭环，避免陈旧任务参与下一轮
  - [x] 对可见状态快照建立明确更新时机（同步后提交快照）
  - [x] 对 range 不可用重试增加幂等保护，避免重复回放抖动

- [x] Task 13: 对照大盘看板验证同路径生命周期管理
  - [x] 对比大盘中对应开关路径的状态初始化与清理策略
  - [x] 仅在确认缺失时补齐最小保护；若已具备，记录对照结论

- [x] Task 14: 交替场景专项回归
  - [x] 执行至少三轮连续“关闭->开启”验证（低波与价值各一轮）
  - [x] 验证每轮开启均有数据且联动/TIPS正常
  - [x] 执行 `npm run lint` 与 `npm run check` 并更新 checklist 勾选

## 第三批依赖
- Task 12 depends on Task 11
- Task 13 can run in parallel with Task 12
- Task 14 depends on Task 12-13

## 第四批根因修复（对标大盘：数据常驻）
- [x] Task 15: 对齐大盘“数据常驻”策略，移除副图隐藏时写空数组路径
  - [x] 在 `LowVolOpportunityChart` 中将副图 `setData` 改为始终写入完整序列
  - [x] 保持隐藏逻辑仅控制 pane 可见性与交互，不影响数据缓存
  - [x] 清理与“写空恢复”强耦合的补偿分支，避免状态震荡

- [x] Task 16: 重构联动集合为确定性重建（与数据写入解耦）
  - [x] 每次开关后按当前可见 pane 重建 crosshair/range 联动集合
  - [x] 确保联动失败不会影响副图数据可见性
  - [x] 保持与大盘看板联动行为一致

- [x] Task 17: 价值择时映射与大盘对照复核
  - [x] 验证 ValueTiming 映射在“数据常驻”模式下不引入空值回归
  - [x] 对照 `MarketLiquidityChart` 记录关键差异与已对齐点

- [x] Task 18: 严格回归与验收
  - [x] 连续 5 轮“关闭->开启”验证低波与价值（每轮首次开启必须有数据）
  - [x] 验证每轮光标联动与 TIPS 正常
  - [x] 执行 `npm run lint` / `npm run check` 并更新 checklist

## 第四批依赖
- Task 16 depends on Task 15
- Task 17 can run in parallel with Task 16
- Task 18 depends on Task 16-17
