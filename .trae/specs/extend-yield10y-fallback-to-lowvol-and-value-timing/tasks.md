# Tasks

- [x] Task 1: 盘点两模块10Y依赖与可复用点（最小改造边界）
  - [x] SubTask 1.1: 定位低波红利与价值择时当前 10Y 拉取入口、重试参数、失败处理路径
  - [x] SubTask 1.2: 确认与 `harden-market-board-yield10y-fallback` 的公共能力复用方案（避免重复实现）

- [x] Task 2: 将10Y主源+回退能力接入价值择时
  - [x] SubTask 2.1: 价值择时 10Y 拉取改为 Chinamoney 主源 + Baostock 回退（受控重试）
  - [x] SubTask 2.2: 在日志/notes 标记 source、fallback、失败摘要
  - [x] SubTask 2.3: 保持“部分成功/失败保护”策略不回归

- [x] Task 3: 将10Y主源+回退能力接入低波红利
  - [x] SubTask 3.1: 低波红利 10Y 拉取改为 Chinamoney 主源 + Baostock 回退（受控重试）
  - [x] SubTask 3.2: 在日志/notes 标记 source、fallback、失败摘要
  - [x] SubTask 3.3: 保持 run 原子发布与失败不切换可见 run 的行为不变

- [x] Task 4: 回归验证（稳定性导向）
  - [x] SubTask 4.1: 模拟 Chinamoney 超时，验证两模块均可自动回退并继续流程
  - [x] SubTask 4.2: 模拟主源+替代源都失败，验证两模块均不发布不完整新结果
  - [x] SubTask 4.3: 运行 `npm run check`（必要时含相关脚本/测试）确保无新增错误

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2, Task 3
