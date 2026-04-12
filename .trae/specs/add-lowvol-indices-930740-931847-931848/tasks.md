# Tasks
- [ ] Task 1: 前端低波指数卡片新增 3 支指数
  - [ ] 在 `LOWVOL_INDEX_OPTIONS` 增加 930740.CSI / 931847.CSI / 931848.CSI 的 code、简称 label、简介 desc（≤100字）
  - [ ] 确认卡片 hover/选中态在新增卡片上表现一致，文案不换行溢出可接受

- [ ] Task 2: 服务端接入新增指数的 PRI/TRI 配置与拉取
  - [ ] 在 `server/lib/lowVol.ts` 的 `LOWVOL_INDEXES` 增加 3 支指数配置（code/name/priCode/triCode）
  - [ ] 如 csindex 的 PRI 拉取不支持 `.CSI`，增加 PRI code 归一化（从 `930740.CSI` 提取 `930740`）并确保不影响现有指数

- [ ] Task 3: 指数页面介绍文案与卡片简介保持一致
  - [ ] `LowVolOpportunityPanel` 接收 `indexDesc` 并用于顶部第一段介绍（无 desc 时保留 fallback）
  - [ ] `Home` 在渲染 `LowVolOpportunityPanel` 时传入当前选中指数的 `desc`

- [ ] Task 4: 验证与回归
  - [ ] 手动验证三支指数能加载数据（PRI/TRI 均可用）、指标字段非全空、切换 SMA250/SMA60 生效
  - [ ] 验证 TRI 不可用时能进入错误态（而非静默空图）
  - [ ] 回归验证既有指数（H30269/932365/932315/930955/980081）功能不受影响

# Task Dependencies
- Task 3 depends on Task 1
- Task 4 depends on Task 1, Task 2, Task 3

