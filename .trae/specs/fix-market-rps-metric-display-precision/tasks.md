# Tasks
- [x] Task 1: 复核市场风格RPS截面值的真实来源与异常成因
  - [x] SubTask 1.1: 对照接口返回、落表数据与前端展示，确认 `RPS`、`MA50` 是否为真实相近还是展示失真
  - [x] SubTask 1.2: 定位异常成因属于计算逻辑、数据读取、缓存残留还是格式化精度不足
  - [x] SubTask 1.3: 梳理 RPS 模块中其它使用相同展示或格式化逻辑的位置

- [ ] Task 2: 修复当前RPS与MA50展示异常
  - [ ] SubTask 2.1: 按核查结果修复服务端计算、前端展示精度或取值逻辑
  - [ ] SubTask 2.2: 确保 `Score 截面数据` 中 `RPS`、`MA50` 与真实数据一致且可辨识
  - [ ] SubTask 2.3: 校对修复后不会破坏 `Score%`、趋势方向及现有图表视图

- [ ] Task 3: 排查并修复类似场景
  - [ ] SubTask 3.1: 检查 RPS 模块内其它相同格式化入口、表格列或图表 hover 是否存在同类问题
  - [ ] SubTask 3.2: 若发现同类“数值被展示精度掩盖”的场景，一并修复
  - [ ] SubTask 3.3: 明确本次排查范围与未发现问题的结论

- [ ] Task 4: 回归验证与交付
  - [ ] SubTask 4.1: 增加或更新直接相关测试/断言，覆盖本次异常场景
  - [ ] SubTask 4.2: 运行直接相关检查，验证页面展示、接口数据与排查结果符合 spec
  - [ ] SubTask 4.3: 确认用户截图中暴露的问题已消除，且无新增明显展示误导

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
