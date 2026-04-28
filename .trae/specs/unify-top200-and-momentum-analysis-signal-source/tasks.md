# Tasks
- [x] Task 1: 明确全链路统一口径的边界与共享入口
  - [x] SubTask 1.1: 盘点 ETF200 快照脚本、动量分析查询接口、图表信号渲染当前各自依赖的 ETF 价格、`H30269` 基准与截止日来源
  - [x] SubTask 1.2: 定义共享信号序列构建入口，明确输入参数、返回结构、异常处理与可复用范围
  - [x] SubTask 1.3: 明确稳定基准 run 的读取规则、缺失时的失败策略和与现有发布链路的关系

- [x] Task 2: 将 ETF200 快照发布链路切换到统一信号序列
  - [x] SubTask 2.1: 重构 `refreshTop100Snapshot` 与 `publishTop100ToSupabase`，统一使用共享信号序列入口
  - [x] SubTask 2.2: 保证快照计算只以每行 `latestTradingDate` 作为截止日，不混入更晚数据
  - [x] SubTask 2.3: 对稳定基准缺失、序列不完整或单只 ETF 计算失败场景给出明确发布策略，避免写入不确定结果
  - [x] SubTask 2.4: 补充最小调试能力，支持指定 ticker 输出序列尾部与最终快照

- [x] Task 3: 将动量分析查询链路切换到统一信号序列
  - [x] SubTask 3.1: 重构 `rpsStyle` 查询能力，改为复用与 ETF200 快照一致的基准序列和截止日规则
  - [x] SubTask 3.2: 保证动量分析页主图信号箭头、摘要信号与 ETF200 列表读取同一口径
  - [x] SubTask 3.3: 验证 `Baseline策略` 与 `baseColorFlip` 都通过共享入口计算，不残留并行旧逻辑

- [x] Task 4: 完成全链路一致性与回归验证
  - [x] SubTask 4.1: 为共享信号序列和敏感样本补充自动化测试，至少覆盖 `513690`
  - [x] SubTask 4.2: 验证 GitHub/本地重复计算在同一截止日下结果一致
  - [x] SubTask 4.3: 验证 ETF200 列表与动量分析页对同一 ETF 的 `signalDate` 与 `freshnessBucket` 一致
  - [x] SubTask 4.4: 运行类型检查、直接相关单测、构建和本地 mock/浏览器回归

- [x] Task 5: 完成交付与发布验证说明
  - [x] SubTask 5.1: 更新相关任务状态与验收记录，明确 C 方案已替换旧的双口径实现
  - [x] SubTask 5.2: 给出发布后核对步骤，包括 Supabase 快照值、动量分析页显示与指定 ticker 调试方法

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 4
