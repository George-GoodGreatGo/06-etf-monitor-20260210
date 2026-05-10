# Tasks

- [ ] Task 1: 调整 momentumStrategies.ts
  - [ ] 1.1 `DEFAULT_MOMENTUM_STRATEGY_ID` 改为 `'confirmTrail12'`
  - [ ] 1.2 `MOMENTUM_STRATEGIES` 数组重排：confirmTrail12（roleLabel: '默认策略'）→ baselineEnhanced（roleLabel: ''）→ baseColorFlip（不变）
  - [ ] 1.3 `npx tsc --noEmit` 编译验证
