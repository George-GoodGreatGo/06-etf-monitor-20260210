# Task7 严格回归执行证据（本次阻塞）

## 执行范围
- 启动本地应用并尝试自动化回归（低波/价值连续 5 轮副图关闭->开启，验证首次有数据 + 光标/日期/TIPS 联动）
- 对照大盘看板联动回归
- 仅做验证与文档回填，不改业务代码

## 关键执行记录
- 启动应用：
  - 命令：`npm run dev`
  - 结果：前端 `http://localhost:5173/`、后端 `http://localhost:3001/` 正常启动
- 自动化回归脚本：
  - 命令：`npx playwright test tmp/task7-regression.spec.js --workers=1 --reporter=line --timeout=180000`
  - 结果：脚本可运行并可登录到 `/market`，但在“低波数据可用性前置检查”处失败
- 低波 summary 快照：
  - 命令：`node -e "fetch('http://localhost:3001/api/lowvol/summary').then(r=>r.text()).then(console.log)"`
  - 结果：`meta.notes=["ok=0","fail=10"]`，全部指数 `no_data/run=all:empty`
- 价值 summary 快照：
  - 命令：`node -e "fetch('http://localhost:3001/api/value/summary').then(r=>r.text()).then(console.log)"`
  - 结果：`meta.notes=["ok=0","fail=3"]`，全部指数 `no_data/run=all:empty`
- 尝试补数据（低波）：
  - 命令：`npx tsx server/scripts/refreshLowVolSnapshots.ts`
  - 结果：失败，明确报错 `missing env: SUPABASE_URL`

## 阻塞结论
- 当前环境缺少 `SUPABASE_URL`，且低波/价值均无可用 run。
- 因“首次开启必须有数据”这一 Task7 前提不满足，无法完成以下验证并出具通过结论：
  - 低波/价值连续 5 轮副图关闭->开启
  - 每轮光标联动、日期联动、TIPS 持续更新
  - 大盘联动无回归的完整对照结论

## 已回填
- `tasks.md` 与 `checklist.md` 已同步阻塞原因，未错误勾选未完成项。
