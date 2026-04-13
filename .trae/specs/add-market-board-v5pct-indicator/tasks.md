# Tasks
- [x] Task 1: 后端新增 v5Pct 计算与输出
  - [x] 在流动性序列构建处增加 `v5Pct`：对 `v5` 做 5 年滚动分位（window≈1260，min≈630）
  - [x] 接口返回结构保持不变（仅在点位结构新增字段），缺失值策略与现有一致（null → 前端显示 “—”）
  - [x] 更新接口 meta/notes 中对参数口径的说明（新增 v5Pct 说明）

- [x] Task 2: 前端类型与数据表/图表适配
  - [x] 扩展 `LiquidityV5Point` 类型，新增 `v5Pct: number | null`
  - [x] 表格视图新增列：v5Pct（单位 %）
  - [x] 图表视图新增 1 个副图窗格：v5Pct（0–100，固定 Y 轴、禁用 Y 缩放），并与其它窗格保持 timeScale/crosshair/wheel 联动

- [x] Task 3: 看板指标说明补充 v5Pct 的定义与解读
  - [x] 指标说明新增一条：解释 v5Pct = v5 的 5 年滚动分位（0–100）及其指示意义

- [x] Task 4: 回归验证
  - [x] 手动验证：图表新增窗格正常渲染；各窗格联动一致；v5Pct 数值范围 0–100
  - [x] 手动验证：表格列展示 v5Pct 且单位明确；缺失值显示为 “—”
  - [x] `npm run build` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
