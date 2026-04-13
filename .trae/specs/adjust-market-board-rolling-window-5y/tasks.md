# Tasks
- [x] Task 1: 梳理并定位大盘看板相关的滚动分位窗口常量
  - [x] 确认独家流动性指数三指标分位（amountPct/trPct/northPct）当前窗口与 minPeriods 定义位置
  - [x] 确认股债性价比（分位）pct 当前窗口与 minPeriods 定义位置
  - [x] 盘点受影响的文案/说明（指标说明、表格列说明、接口 notes/meta）

- [x] Task 2: 后端将分位滚动窗口统一调整为 5 年（1260 / min 630）
  - [x] 独家流动性指数：amountPct/trPct/northPct 的 windowDays=1260、minPeriods=630
  - [x] 股债性价比（分位）：pct 的 windowDays=1260、minPeriods=630
  - [x] 若存在缓存：更新缓存版本键或 cache tag，确保口径变化后不会复用旧口径结果
  - [x] 保持接口字段结构与类型不变（仅数值口径变化）

- [x] Task 3: 前端适配与文案同步
  - [x] 更新大盘看板指标说明：360/720 替换为 5年（≈1260，min≈630）
  - [x] 更新表格视图的列说明/表头提示（如存在）
  - [x] 若图表内存在参数提示/tooltip 文案，同步更新为 5年口径

- [x] Task 4: 回归验证
  - [x] 新增或更新单元测试：滚动分位在 windowDays=1260、minPeriods=630 下的边界行为（不足样本返回 null/NaN）
  - [x] 手动验证：图表与表格（如存在）口径一致、页面正常渲染
  - [x] `npm run build` 通过

# Task Dependencies
- Task 3 depends on Task 2
- Task 4 depends on Task 2
