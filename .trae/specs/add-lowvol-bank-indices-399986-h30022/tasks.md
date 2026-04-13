# Tasks
- [x] Task 1: 后端扩展低波指数配置
  - [x] 在 `server/lib/lowVol.ts` 的 `LOWVOL_INDEXES` 新增：
    - `399986`：name=中证银行，priCode=399986，triCode=H20180
    - `H30022`：name=中证800银行，priCode=H30022，triCode=H20022
  - [x] 确保 `getLowVolSupportedIndexCodes()` 自动包含新增 code

- [x] Task 2: 前端指数选项扩展
  - [x] 在低波机会的指数选项列表中新增两项（label/desc/code）
  - [x] 选择后页面可正常加载并展示（含快照提示 meta）

- [x] Task 3: 定时快照刷新覆盖新增指数
  - [x] 确认 `server/scripts/refreshLowVolSnapshots.ts` 通过支持清单自动刷新新增指数（无需手工 hardcode）

- [x] Task 4: 回归与验收
  - [x] 新增两指数在 UI 可见、可切换
  - [x] `/api/lowvol/index/:code` 能返回对应数据（有快照时）
  - [x] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 4 depends on Task 1-3
