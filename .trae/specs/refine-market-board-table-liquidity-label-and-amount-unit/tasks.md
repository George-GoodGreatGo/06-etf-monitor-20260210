# Tasks

- [x] Task 1: 梳理并锁定成交额单位统一方案（落表即亿元）
  - [x] SubTask 1.1: 明确当前成交额字段在采集、计算、落表、API、前端各环节的单位
  - [x] SubTask 1.2: 确认“落表前换算为亿元”作为唯一口径，并定义旧数据兼容策略

- [x] Task 2: 后端改造成交额字段为亿元统一口径
  - [x] SubTask 2.1: 在大盘看板落表链路中将成交额转换为亿元并写入
  - [x] SubTask 2.2: 更新 API 返回与 meta 说明，声明成交额单位为亿元
  - [x] SubTask 2.3: 增加防混用校验，避免千元数据被按亿元展示

- [x] Task 3: 前端表格文案与展示调整
  - [x] SubTask 3.1: 将列标题从“成交额（沪+深,千元）”改为“成交额（沪+深，亿元）”
  - [x] SubTask 3.2: 移除“独家流动性指数（5年分位）”单元格内“样本不足”字样，不影响数值展示
  - [x] SubTask 3.3: 保持缺失值与异常值显示规则不回归

- [x] Task 4: 回归验证与发布前检查
  - [x] SubTask 4.1: 校验表格中成交额单位、标题、数值量纲一致
  - [x] SubTask 4.2: 校验流动性分位列不再出现“样本不足”字样且读数连续
  - [x] SubTask 4.3: 运行 `npm run check`（及必要的 lint/build）确保无新增错误

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2, Task 3
