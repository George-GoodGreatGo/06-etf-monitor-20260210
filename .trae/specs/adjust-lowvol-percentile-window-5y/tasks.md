# Tasks
- [x] Task 1: 后端调整分位窗口为 5 年
  - [x] 将 BIAS 分位窗口从 3 年（756）调整为 5 年（1260）
  - [x] 将利差分位窗口从 10 年（2520）调整为 5 年（1260）
  - [x] 更新 `meta.notes` 文案，避免 “3年/10年” 的旧描述残留

- [x] Task 2: 前端标签与提示更新
  - [x] 图表/按钮中的“3年/10年分位”字样统一改为 “5年分位”
  - [x] 保持字段兼容：若后端不新增字段名，则前端只改文案即可

- [x] Task 3: 回归与验收
  - [x] 抽样检查：分位输出范围 0-100 且缺失规则不变（minPeriods=252）
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1-2
