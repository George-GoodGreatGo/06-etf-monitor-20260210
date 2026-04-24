# Tasks
- [x] Task 1: 梳理动量分析主图买卖信号的判定边界
  - [x] SubTask 1.1: 确认主图当前价格线颜色分段所依据的区间映射，明确绿色与黄色的切换判定口径
  - [x] SubTask 1.2: 确认 `SMA250` 与价格序列的日期对齐方式，定义“价格在 `SMA250` 上方”的判定规则
  - [x] SubTask 1.3: 明确买入、卖出箭头与现有放量圆点在 marker 层的共存方式，避免覆盖或重复

- [x] Task 2: 为动量分析主图新增买卖信号箭头
  - [x] SubTask 2.1: 在主图 marker 生成逻辑中实现“绿转黄且价格在 `SMA250` 上方”的红色向上箭头
  - [x] SubTask 2.2: 在主图 marker 生成逻辑中实现“黄转绿”的绿色向下箭头
  - [x] SubTask 2.3: 校正箭头位置，使买入箭头位于价格点下方、卖出箭头位于价格点上方，并保持日期对齐

- [x] Task 3: 更新主图说明与页面信号文案
  - [x] SubTask 3.1: 在主图说明中补充买入/卖出箭头的图例描述
  - [x] SubTask 3.2: 确认新增文案与现有价格颜色规则、放量圆点说明不冲突

- [x] Task 4: 回归验证动量分析图表交互
  - [x] SubTask 4.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [x] SubTask 4.2: 验证红色向上箭头仅在“绿转黄且价格高于 `SMA250`”时出现
  - [x] SubTask 4.3: 验证绿色向下箭头在“黄转绿”时出现，且不会与买入箭头重复
  - [x] SubTask 4.4: 验证新增箭头后，主图 hover、缩放、十字光标与副图联动仍保持正常

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2 and Task 3
