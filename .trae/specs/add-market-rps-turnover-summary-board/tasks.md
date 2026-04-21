# Tasks
- [x] Task 1: 明确摘要公告板的数据口径与展示范围
  - [x] SubTask 1.1: 复用现有目标 ETF 列表，确认摘要区需覆盖全部目标 ETF
  - [x] SubTask 1.2: 明确“最近一次放量”定义沿用 `成交额较前 20 日均值倍数 >= 1.50X`
  - [x] SubTask 1.3: 明确“X 个交易日前”以该 ETF 当前最新交易日为基准计算，不使用自然日差值
  - [x] SubTask 1.4: 明确无放量记录时的空状态展示规则

- [x] Task 2: 补充摘要公告板所需的数据聚合能力
  - [x] SubTask 2.1: 在现有成交额历史聚合基础上，为每支 ETF 计算最近一次满足阈值的放量记录
  - [x] SubTask 2.2: 返回最近一次放量日期与对应的交易日间隔
  - [x] SubTask 2.3: 对无命中阈值的 ETF 返回明确空值状态，不输出推测结果

- [x] Task 3: 在成交金额追踪板块新增摘要公告板
  - [x] SubTask 3.1: 在 `成交金额追踪` 板块中增加公告板式摘要区域
  - [x] SubTask 3.2: 直接铺出所有目标 ETF 的摘要项，展示 ETF 代码名称、最近一次放量日期与 `X 个交易日前`
  - [x] SubTask 3.3: 保留现有单 ETF 选择按钮、基准指数展示与 90 交易日明细表

- [x] Task 4: 完成摘要态样式与异常态展示
  - [x] SubTask 4.1: 让摘要公告板在长列表与不同屏宽下保持可读
  - [x] SubTask 4.2: 为无放量记录或无可用数据的 ETF 提供清晰空状态文案
  - [x] SubTask 4.3: 校对摘要信息与明细表并存时的阅读顺序和布局稳定性

- [x] Task 5: 回归验证与交付
  - [x] SubTask 5.1: 运行前后端相关检查（如 lint/typecheck/必要测试）
  - [x] SubTask 5.2: 验证所有目标 ETF 的最近一次放量日期与交易日间隔展示正确
  - [x] SubTask 5.3: 验证无放量记录场景、摘要区与明细区共存场景符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 2, Task 3, and Task 4
