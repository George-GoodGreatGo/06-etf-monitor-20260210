# Tasks
- [x] Task 1: 识别“自定义查询”旧文案的用户可见入口
  - [x] SubTask 1.1: 确认左侧二级菜单中的旧文案位置
  - [x] SubTask 1.2: 确认 RPS 独立页主标题中的旧文案位置
  - [x] SubTask 1.3: 确认面包屑中的旧文案位置，避免替换不完整

- [x] Task 2: 统一替换为“动量分析”
  - [x] SubTask 2.1: 将左侧二级菜单 `自定义查询` 改为 `动量分析`
  - [x] SubTask 2.2: 将页面主标题 `ETF自定义查询（RPS）` 改为 `动量分析`
  - [x] SubTask 2.3: 将面包屑当前页文案改为 `动量分析`

- [x] Task 3: 回归验证可见文案一致性
  - [x] SubTask 3.1: 验证左侧菜单、面包屑、页面标题三处文案一致
  - [x] SubTask 3.2: 验证路由、选中态和页面功能未因文案替换受影响
  - [x] SubTask 3.3: 运行相关前端检查命令，确认未引入直接相关回归

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
