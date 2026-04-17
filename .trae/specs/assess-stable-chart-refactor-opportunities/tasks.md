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
