# Tasks
- [x] Task 1: 明确 RPS 页面成交额表单的选项与数据契约
  - [x] SubTask 1.1: 梳理可选目标 ETF 列表、代码名称映射及默认项“红利低波”
  - [x] SubTask 1.2: 明确每个目标 ETF 对应的基准指数代码名称展示规则
  - [x] SubTask 1.3: 定义前端所需数据结构，覆盖最近 90 个交易日、当日成交额、前 20 日均值倍数与空值占位规则

- [x] Task 2: 新增 RPS 页面下方的 ETF 成交额表单区域
  - [x] SubTask 2.1: 在 `RpsStylePanel` 下方增加表单容器与标题说明
  - [x] SubTask 2.2: 实现目标 ETF 代码名称选择按钮，并设置默认选中“红利低波”
  - [x] SubTask 2.3: 在选中态变化时同步更新对应的基准指数代码名称展示

- [x] Task 3: 接入最近 90 个交易日成交额数据并完成倍数计算展示
  - [x] SubTask 3.1: 补充接口或聚合逻辑，返回所选 ETF 最近 90 个交易日所需字段
  - [x] SubTask 3.2: 按 `当日成交额 / 过去 20 个交易日成交额均值` 计算倍数并保留 2 位小数
  - [x] SubTask 3.3: 对样本不足 20 个交易日的记录返回空值占位，不输出推测值

- [x] Task 4: 完成表格样式与高亮规则
  - [x] SubTask 4.1: 在表格中展示 `交易日`、`当日成交额`、`成交额较前 20 日均值倍数` 三列
  - [x] SubTask 4.2: 对 `成交额较前 20 日均值倍数 >= 1.50` 的单元格做高亮处理
  - [x] SubTask 4.3: 校对默认态、切换态与高亮态下的布局稳定性

- [x] Task 5: 回归验证与交付
  - [x] SubTask 5.1: 运行前端检查（如 lint/typecheck）并修复直接相关问题
  - [x] SubTask 5.2: 验证默认选中“红利低波”、ETF 切换、90 个交易日数据展示、2 位小数与高亮阈值符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3, and Task 4
