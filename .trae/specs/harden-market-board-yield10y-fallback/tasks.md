# Tasks

- [x] Task 1: 明确 10Y 主源/替代源与降级顺序（最小改动）
  - [x] SubTask 1.1: 盘点当前 Chinamoney 调用点、重试预算、超时参数
  - [x] SubTask 1.2: 选定 1 个可立即接入的替代源（或已有快照回退）并定义优先级
  - [x] SubTask 1.3: 明确“主源失败不阻塞全流程”的判定条件与日志字段

- [x] Task 2: 实现 10Y 链路的受控重试与自动回退
  - [x] SubTask 2.1: 限制 Chinamoney 重试总预算（次数/时长）并支持快速失败
  - [x] SubTask 2.2: 接入替代源获取 10Y，输出统一字段格式
  - [x] SubTask 2.3: 在 `meta.notes` 和回灌日志记录 source/fallback/失败原因

- [x] Task 3: 接入回灌探测与发布保护校验
  - [x] SubTask 3.1: 调整 probe 逻辑，10Y 探测支持替代源校验
  - [x] SubTask 3.2: 保持“失败不发布新 run、沿用旧 run”行为不变

- [x] Task 4: 回归验证（GitHub Action 场景导向）
  - [x] SubTask 4.1: 模拟 Chinamoney 超时，验证可自动切换替代源并完成计算
  - [x] SubTask 4.2: 模拟主源+替代源均失败，验证不发布新 run 且错误可定位
  - [x] SubTask 4.3: 运行 `npm run check`（必要时含 build）确保无新增错误

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2, Task 3
