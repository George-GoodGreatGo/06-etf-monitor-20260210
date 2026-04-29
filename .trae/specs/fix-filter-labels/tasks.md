# Tasks

- [x] Task 1: Top100FilterBar.tsx — label 添加 `whitespace-nowrap`
  - [x] `TagGroup` 的 label span 添加 `whitespace-nowrap`
  - [x] `StrategyTagGroup` 的 label span 添加 `whitespace-nowrap`

- [x] Task 2: Home.tsx — 策略选项名改用 `strategy.label`
  - [x] `TOP200_STRATEGY_OPTIONS` 的 label 从 `strategy.shortLabel` 改为 `strategy.label`

- [x] Task 3: DevTop200MomentumSignalsMock.tsx — 同步修改
  - [x] `STRATEGY_OPTIONS` 的 label 从 `strategy.shortLabel` 改为 `strategy.label`

- [x] Task 4: 回归验证
  - [x] `npm run check` 通过
  - [x] `npm run build` 构建成功

# Task Dependencies
- Task 1–3 互相独立，可并行
- Task 4 依赖 Task 1–3
