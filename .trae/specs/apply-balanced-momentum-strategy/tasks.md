# Tasks
- [x] Task 1: 梳理动量分析页面中推荐平衡版信号所需的现有计算与交互入口
  - [x] SubTask 1.1: 确认主图当前买卖箭头生成逻辑、价格颜色切换口径与 marker hover 数据来源
  - [x] SubTask 1.2: 确认 `SMA20`、`SMA60`、`SMA250`、`MACD Hist`、`RSI(14)` 在主图数据准备阶段的现有可用性
  - [x] SubTask 1.3: 确认主图说明文案与 hover 信息面板的插入位置，保证页面交互简洁且不遮挡图表

- [x] Task 2: 将主图买卖箭头逻辑升级为推荐平衡版
  - [x] SubTask 2.1: 将买入条件改为 `绿 -> 黄` 且 `价格 >= SMA250` 且 `价格 >= SMA20` 且 `SMA60 >= SMA250`
  - [x] SubTask 2.2: 将卖出条件改为 `黄 -> 绿` 且满足 `价格 < SMA20`、`MACD Hist < 0`、`RSI(14) < 50` 中至少一项
  - [x] SubTask 2.3: 保持买入箭头在价格点下方、卖出箭头在价格点上方，并继续与放量圆点共存
  - [x] SubTask 2.4: 确保非上升通道下不会出现任何买入箭头

- [x] Task 3: 在页面上增加推荐平衡版策略说明
  - [x] SubTask 3.1: 在动量分析主图区块附近新增“推荐平衡版”策略说明
  - [x] SubTask 3.2: 用简洁文案说明买入规则、卖出规则、上升通道限制与辅助指标作用
  - [x] SubTask 3.3: 调整图例或说明布局，保证信息清晰可查且不打断主要图表操作

- [x] Task 4: 为买卖点 hover 增加原因展示
  - [x] SubTask 4.1: 为买入箭头构造原因数据，至少包含 `绿 -> 黄`、`价格 >= SMA250`、`价格 >= SMA20`、`SMA60 >= SMA250`
  - [x] SubTask 4.2: 为卖出箭头构造原因数据，展示 `黄 -> 绿` 与实际命中的卖出确认项
  - [x] SubTask 4.3: 仅在 hover 到买卖箭头时展示原因说明，普通价格点保持当前简洁 hover 信息
  - [x] SubTask 4.4: 保证箭头原因与当前 hover 日期、十字光标和联动范围保持一致

- [x] Task 5: 回归验证推荐平衡版信号与页面交互
  - [x] SubTask 5.1: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证
  - [x] SubTask 5.2: 验证买入箭头只会在上升通道内、且满足推荐平衡版全部买入条件时出现
  - [x] SubTask 5.3: 验证卖出箭头只会在 `黄 -> 绿` 且命中至少一个卖出确认条件时出现
  - [x] SubTask 5.4: 验证页面新增策略说明后，布局仍保持简洁清晰
  - [x] SubTask 5.5: 验证 hover 到买卖箭头时能展示正确原因，hover 非箭头时不出现冗余说明
  - [x] SubTask 5.6: 验证缩放、平移、十字光标与主副图联动未出现明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1 and Task 2
- Task 5 depends on Task 2, Task 3, and Task 4
