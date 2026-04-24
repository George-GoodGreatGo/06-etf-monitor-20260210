# Tasks
- [x] Task 1: 明确默认/保守模式的页面方法论与用户可见定义
  - [x] SubTask 1.1: 固化默认模式的买入、卖出和风控条件，确保与已验证建议策略一致
  - [x] SubTask 1.2: 固化保守模式的额外趋势确认条件，确保与默认模式差异清晰且可解释
  - [x] SubTask 1.3: 明确页面说明文案需要传达的方法论差异与共同约束

- [x] Task 2: 在动量分析页增加默认/保守模式切换
  - [x] SubTask 2.1: 设计并接入页面级模式状态，保证默认模式为首次进入时的默认值
  - [x] SubTask 2.2: 在页面中增加 `默认 / 保守` 切换控件，并与图表区域保持风格一致
  - [x] SubTask 2.3: 确认模式切换不会影响现有 ETF 查询、最近搜索和图表联动功能

- [x] Task 3: 按模式重算买卖箭头与 hover 信号状态
  - [x] SubTask 3.1: 将主图买卖箭头逻辑改为读取当前模式对应的信号条件
  - [x] SubTask 3.2: 在 hover 面板中增加当前模式名称、买入条件状态、卖出条件状态和风控条件状态
  - [x] SubTask 3.3: 保证模式切换后，箭头、hover 与现有放量圆点和均线显示保持一致

- [x] Task 4: 更新图例与方法论说明文案
  - [x] SubTask 4.1: 在标题下说明区域补充默认模式与保守模式的方法论说明
  - [x] SubTask 4.2: 在主图图例中明确箭头按当前模式计算，并说明保守模式的额外确认条件
  - [x] SubTask 4.3: 保留并强调“买入只能发生在 `SMA250` 上方”的统一原则

- [x] Task 5: 回归验证模式切换与信号展示
  - [x] SubTask 5.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [x] SubTask 5.2: 验证默认/保守模式切换后，主图箭头会按模式变化
  - [x] SubTask 5.3: 验证 hover 面板会显示当前模式下的信号满足情况
  - [x] SubTask 5.4: 验证图例、说明文案、缩放、平移、十字光标与副图联动未出现直接相关回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 1
- Task 5 depends on Task 2, Task 3 and Task 4
