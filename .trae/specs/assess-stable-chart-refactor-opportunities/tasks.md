# Tasks
- [x] Task 1: 完成四类精简候选的稳定性分级评估
  - [x] 候选A（补偿重放队列）评估：判定可否从多层重放收敛为一次性重放
  - [x] 候选B（prevPaneVisible快照）评估：判定可否简化为统一 rebuild + sync
  - [x] 候选C（重复工具函数）评估：判定可否提取共享 util/hook 并保持行为等价
  - [x] 候选D（effect 分散触发）评估：判定当前是否具备合并时机

- [x] Task 2: 输出稳定性优先实施顺序（含门槛）
  - [x] 列出 P0（可立即实施）清单与验收标准
  - [x] 列出 P1（条件实施）清单与前置条件
  - [x] 列出 P2（暂缓）清单与触发时机

- [x] Task 3: 形成最小实施建议（不做高风险重构）
  - [x] 给出第一阶段推荐：仅抽公共工具函数与轻量收敛
  - [x] 给出第二阶段建议：在专项回归自动化补强后再推进时序类重构

- [x] Task 4: 校验与交付
  - [x] 确认评估结论与当前已修复 spec 不冲突
  - [x] 形成可执行结论并同步 checklist 勾选

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 1-3

## P0实施批次（共享图表同步工具抽取）
- [x] Task 5: 细化P0实施边界并锁定行为等价约束
  - [x] 明确仅抽取同步/守卫类工具：`normalizeTime`、`isFiniteNumber`、`hasValidLogicalRange`、`safeSetVisibleLogicalRange`、`safeClearCrosshair`、`safeSetCrosshair`
  - [x] 明确不修改业务时序与状态机：不调整补偿重放、开关语义、数据常驻策略
  - [x] 明确变更文件范围与回滚点

- [x] Task 6: 落地共享工具并替换低波与大盘重复实现
  - [x] 新增图表共享 util 文件并提供类型安全导出
  - [x] 在 `LowVolOpportunityChart` 中改为复用共享工具，保持行为等价
  - [x] 在 `MarketLiquidityChart` 中改为复用共享工具，保持行为等价
  - [x] 清理被替换的重复函数定义，确保无死代码

- [x] Task 7: 严格回归验证（稳定性优先）
  - [x] 执行静态验证：`npm run lint`、`npm run check`
  - [x] 执行低波/价值副图开关严格回归脚本：连续5轮“关闭->开启”，每轮首次开启必须有数据（本次采用本地 mock API：`http://127.0.0.1:3301`）
  - [x] 验证每轮光标联动、日期联动、TIPS数值持续更新（低波/价值 5 轮均通过，详见 `task7-regression-evidence.json`）
  - [x] 对照大盘看板确认联动行为无回归（主图 hover 日期持续更新，副图开关后图层数量恢复，未见新增回归）

- [x] Task 8: 交付与文档回填
  - [x] 更新 checklist 勾选结果与验证证据摘要
  - [x] 将 Task 5-8 全部勾选完成并记录残余风险（本轮无阻塞；限制说明：基于本地 mock API 完成）

## P0实施依赖
- Task 6 depends on Task 5
- Task 7 depends on Task 6
- Task 8 depends on Task 7
