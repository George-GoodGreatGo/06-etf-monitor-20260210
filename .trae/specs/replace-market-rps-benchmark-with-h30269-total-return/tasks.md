# Tasks
- [x] Task 1: 明确市场风格RPS的基准切换边界
  - [x] SubTask 1.1: 梳理服务端当前使用 `512890.SH` 作为分母的计算入口、常量和元数据输出位置
  - [x] SubTask 1.2: 确认前端页面中所有基准说明、图例标签和默认文案的替换范围
  - [x] SubTask 1.3: 明确 `H30269` 在接口与前端中的统一命名为“红利低波全收益指数”

- [x] Task 2: 将RPS计算与接口元数据切换为 H30269
  - [x] SubTask 2.1: 将服务端 RPS 基准常量与取数逻辑从 `512890.SH` 切换到 `H30269`
  - [x] SubTask 2.2: 调整接口返回中的基准代码、名称和说明字段，避免残留 ETF 基准口径
  - [x] SubTask 2.3: 校对截面数据、趋势序列和相关 notes 文本在切换后仍自洽

- [x] Task 3: 更新前端基准展示与图表标签
  - [x] SubTask 3.1: 将页面说明区中的基准分母、视图解释和趋势描述统一替换为 `H30269`
  - [x] SubTask 3.2: 更新图表基准标签与图例展示，移除 `512890.SH=1` 等旧文案
  - [x] SubTask 3.3: 校对基准替换后页面布局、按钮和提示文案无明显错位

- [x] Task 4: 补充回归验证与交付
  - [x] SubTask 4.1: 更新与基准相关的服务端测试或断言
  - [x] SubTask 4.2: 运行直接相关检查，验证三种视图、截面数据和基准文案符合 spec
  - [x] SubTask 4.3: 确认页面与接口中不再残留 `512890.SH` / “红利低波ETF” 作为 RPS 基准

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
