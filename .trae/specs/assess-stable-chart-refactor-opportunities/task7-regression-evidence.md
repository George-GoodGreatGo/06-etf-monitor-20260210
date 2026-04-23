# Task7 严格回归执行证据（本次通过）

## 执行范围
- 使用本地 mock API 完成低波/价值 5 轮副图开关联动严格回归
- 对照大盘看板完成联动行为回归复核
- 生成结构化证据（JSON）与截图（PNG），并回填 tasks/checklist

## 关键执行记录
- 启动本地 mock API：
  - 命令：`node tmp/task7-mock-api.mjs`
  - 结果：`http://127.0.0.1:3301` 启动成功（覆盖 `/api/lowvol/*`、`/api/value/*`、`/api/market/liquidity/v5` 等）
- 启动前端并指向 mock：
  - 命令：`$env:VITE_API_BASE_URL='http://127.0.0.1:3301'; npm run client:dev`
  - 结果：`http://localhost:5173/` 启动成功
- 执行严格回归：
  - 命令：`npx playwright test tmp/task7-regression.spec.js --workers=1 --reporter=line --timeout=240000`
  - 结果：`1 passed`

## 通过结论
- 低波/价值：连续 5 轮“关闭->开启”均通过，且每轮首次开启即有数据。
- 低波/价值：每轮均满足光标与日期联动，TIPS 数值持续更新（详见 `task7-regression-evidence.json`）。
- 大盘对照：副图开关后图层恢复正常（paneCount>=4），主图 hover 日期持续更新，未见联动退化。

## 证据文件
- `task7-regression-evidence.json`
- `task7-lowvol.png`
- `task7-value.png`
- `task7-market.png`

## 已回填
- `tasks.md` 与 `checklist.md` 已完成对应勾选，状态与本次证据一致。
