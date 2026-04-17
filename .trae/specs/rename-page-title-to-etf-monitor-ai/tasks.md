# Tasks
- [x] Task 1: 识别标题来源并确定最小改动点
  - [ ] SubTask 1.1: 定位当前页面标题来源（静态 HTML 或运行时设置）
  - [ ] SubTask 1.2: 确认旧标题文案出现位置，避免遗漏

- [x] Task 2: 将页面展示标题统一为 ETF MONITOR AI
  - [ ] SubTask 2.1: 修改入口标题文案为 `ETF MONITOR AI`
  - [ ] SubTask 2.2: 若存在运行时覆盖逻辑，同步替换为 `ETF MONITOR AI`

- [x] Task 3: 验证标题展示与回归检查
  - [x] SubTask 3.1: 启动页面并确认浏览器标签标题显示为 `ETF MONITOR AI`
  - [x] SubTask 3.2: 切换站内页面后确认标题不回退旧文案
  - [x] SubTask 3.3: 执行项目检查命令（如 `npm run check`）确保无额外回归

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
