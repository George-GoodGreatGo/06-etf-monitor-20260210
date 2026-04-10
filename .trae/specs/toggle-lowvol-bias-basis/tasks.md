# Tasks
- [x] Task 1: 后端补齐 SMA60/BIAS60/BIAS分位(3年) 序列
  - [x] 在 lowVol 指标计算中新增 `ma60`、`bias60`、`biasPct3y60`（保持现有 `ma250`/`bias250`/`biasPct3y` 不变）
  - [x] 更新 lowVol API 的响应类型与序列字段透传
  - [x] 更新前端 marketApi 类型定义以包含新增字段

- [x] Task 2: 前端增加“BIAS 基准”切换开关
  - [x] 在低波机会（Tab 内）提供基准切换控件：SMA250（默认）/ SMA60
  - [x] 切换时不触发额外网络请求即可更新面板内展示（使用同一份序列的不同字段）

- [x] Task 3: 图表与操作建议联动切换
  - [x] BIAS 副图：根据基准展示 bias250 或 bias60，并更新标题文案（BIAS(250)/BIAS(60)）
  - [x] BIAS分位(3年) 副图：根据基准展示 biasPct3y 或 biasPct3y60，并更新标题文案
  - [x] hover 浮层：BIAS 与 BIAS分位字段随基准切换
  - [x] 操作建议：按基准选择对应的 BIAS分位字段，并保持现有 5 条规则与文案一致

- [x] Task 4: 二级导航“操作建议”随基准切换
  - [x] 二级导航建议标签按基准选择 `biasPct3y` 或 `biasPct3y60`
  - [x] 基准切换后，导航标签与面板/hover 的建议保持一致

- [x] Task 5: 验证与回归
  - [x] 三个指数均可在 SMA250/SMA60 间切换，BIAS/BIAS分位曲线与 hover 数值同步变化
  - [x] SMA60 可用前（前 60 点）bias60 与 biasPct3y60 不展示，避免伪值
  - [x] TypeScript 类型检查通过（按项目现有命令）

# Task Dependencies
- Task 3 depends on Task 1-2
- Task 4 depends on Task 1-2
- Task 5 depends on Task 1-4
