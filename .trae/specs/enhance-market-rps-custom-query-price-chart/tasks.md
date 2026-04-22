# Tasks
- [x] Task 1: 明确自定义查询结果摘要与主图增强的数据边界
  - [x] SubTask 1.1: 梳理 `RpsStylePanel` 当前摘要信息的重复位置，确认需要保留、合并或移除的字段
  - [x] SubTask 1.2: 确认自定义查询数据是否已包含成交额 `1.50x` 标记所需字段，并定义 `SMA60`、`SMA250` 的数据来源与前后端契约
  - [x] SubTask 1.3: 明确价格主图分段着色、均线、放量黄点与 hover 联动的实现边界，避免破坏三图同步

- [x] Task 2: 重构自定义查询结果摘要区
  - [x] SubTask 2.1: 将“查询标的 / 最新交易日 / 最新 Score / 基准分母”等信息集中到搜索框下方的单一摘要区
  - [x] SubTask 2.2: 在“当前标的”处稳定展示 `代码 + 名称`
  - [x] SubTask 2.3: 移除或弱化造成重复和分散的独立摘要块，同时保持加载态、错误态和成功态结构清晰

- [x] Task 3: 增强前复权价格主图信号
  - [x] SubTask 3.1: 为自定义查询图表补充 `SMA60`、`SMA250` 数据并渲染到主图
  - [x] SubTask 3.2: 根据 `RPS Score` 阈值实现价格走势分段着色：`<= -8` 绿色、`>= 10` 红色、其他默认色
  - [x] SubTask 3.3: 将 `turnoverMultipleOfPrev20Avg >= 1.50` 的交易日在主图上叠加黄色圆点，并保证日期对齐正确

- [x] Task 4: 统一自定义查询页面视觉样式
  - [x] SubTask 4.1: 检查介绍区、查询区、图表区、成交额区中的高亮白色分割线
  - [x] SubTask 4.2: 将不协调的高亮白色线条替换为低对比度暗色边框或分割样式
  - [x] SubTask 4.3: 校对调整后页面层级、留白与信息聚焦是否优于当前版本

- [x] Task 5: 回归验证与交付
  - [x] SubTask 5.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价校验
  - [x] SubTask 5.2: 验证代码与名称展示、摘要聚合、价格主图分段着色、均线、放量黄点全部生效
  - [x] SubTask 5.3: 验证三图 hover、十字光标、可见范围联动以及成交额追踪区未被本次改动破坏

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2
- Task 5 depends on Task 2, Task 3, and Task 4
