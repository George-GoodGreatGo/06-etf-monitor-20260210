# Tasks
- [x] Task 1: 主图新增 MA60 数据序列
  - [x] 采用前端基于 close 计算 MA60（SMA，窗口=60，minPeriods=60），与现有 MA250（SMA）口径一致
  - [x] 生成 MA60 线数据（窗口=60，少于 60 点不输出）

- [x] Task 2: 主图渲染与控制区
  - [x] 在主图增加 SMA60 线（颜色与样式符合现有风格）
  - [x] 在控制区增加 SMA60 开关，并默认开启；同时将现有 MA250 文案改为 SMA250
  - [x] 主图标题文案随开关组合动态变化（使用 SMA60/SMA250 命名）

- [x] Task 3: Hover 面板展示
  - [x] 当 SMA60 开启时展示 SMA60 数值；关闭时不展示
  - [x] 与现有 MA250/BIAS 等信息排版保持一致

- [x] Task 4: 验证与回归
  - [x] 三个指数均能显示 MA60，并可开关切换
  - [x] 数据点不足 60 的区间不出现 MA60 伪值
  - [x] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
- Task 4 depends on Task 1-3
