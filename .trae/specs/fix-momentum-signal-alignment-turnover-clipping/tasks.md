# Tasks

- [x] Task 1: 扩展 LowVol cron 窗口
  - [x] 修改 `.github/workflows/refresh-lowvol-snapshots.yml`：cron 从 `0,15,30,45 12-13 * * *` 改为 `0,15,30,45 12-14 * * *`

- [x] Task 2: Top200 工作流收口为 LowVol 下游
  - [x] 修改 `.github/workflows/refresh-top100.yml`：移除 `schedule` 两个 cron 条目
  - [x] 新增 `workflow_run` 触发器：`workflows: ["Refresh LowVol Snapshots"]`、`types: [completed]`
  - [x] 在 job 中加入条件过滤：`if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch'`
  - [x] 保留 `workflow_dispatch` 作为紧急手动入口

- [x] Task 3: RPS Style Snapshots 工作流收口为 LowVol 下游
  - [x] 修改 `.github/workflows/refresh-rps-style-snapshots.yml`：移除 `schedule` 两个 cron 条目
  - [x] 新增 `workflow_run` 触发器：`workflows: ["Refresh LowVol Snapshots"]`、`types: [completed]`
  - [x] 在 job 中加入条件过滤：`if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch'`
  - [x] 合并 Refresh (scheduled) 和 Refresh (manual) 步骤为单一 Refresh 步骤
  - [x] 保留 `workflow_dispatch` 作为紧急手动入口

- [x] Task 4: 移除前端「重新获取」按钮及相关逻辑
  - [x] 在 `src/pages/Home.tsx` 中移除「重新获取」按钮 UI
  - [x] 移除 `onRefetch` 函数
  - [x] 移除关联状态：`adminRefreshing`、`adminNotice`、`isVercelBackend`、`activeRefetchTokenKey`
  - [x] 移除 health check useEffect（`apiUrl('/api/health')`）
  - [x] 移除 localStorage 清理逻辑
  - [x] `DataStatusBanner` 通用 retry 保留

- [x] Task 5: 移除后端 `/api/admin/refresh` 路由
  - [x] 在 `server/routes/admin.ts` 中移除 `POST /refresh` 路由定义及关联类型
  - [x] `/market/refresh` 路由保留

- [x] Task 6: 增加 `refreshTop100Snapshot.ts` H30269 防御性校验
  - [x] 在 `hydrateMomentumSignals` 前校验 H30269 日期 ≥ max(latestTradingDate)
  - [x] 不满足时日志记录并 exit 0（静默跳过）

- [x] Task 7: 增加 `refreshRpsStyleSnapshots.ts` H30269 防御性校验
  - [x] 在 `computeRpsStyleDataset` 前校验 H30269 日期 ≥ `endDate10`
  - [x] 不满足时日志记录并 exit 0（静默跳过）

- [x] Task 8: 回归验证
  - [x] TypeScript 编译通过（`npx tsc --noEmit` 零错误）
  - [x] 所有残留引用已清除（grep 零匹配）
  - [x] 工作流文件结构正确
  - [x] 防御性校验代码正确
