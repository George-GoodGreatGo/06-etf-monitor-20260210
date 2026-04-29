# Checklist

- [x] LowVol cron 窗口已扩展至 `0,15,30,45 12-14 * * *`（UTC），最后一场在 UTC 14:00
- [x] Top200 workflow 的 `schedule` 两个 cron 条目已移除
- [x] Top200 workflow 新增 `workflow_run` 触发器，依赖 `Refresh LowVol Snapshots` 完成
- [x] RPS Style Snapshots workflow 的 `schedule` 两个 cron 条目已移除
- [x] RPS Style Snapshots workflow 新增 `workflow_run` 触发器，依赖 `Refresh LowVol Snapshots` 完成
- [x] 两个下游 workflow 的条件过滤：`conclusion == 'success'` 时执行，`workflow_dispatch` 不受影响
- [x] 前端 Home 页面「重新获取」按钮已移除
- [x] `onRefetch` 函数及相关状态（`adminRefreshing`、`adminNotice`、`isVercelBackend` refetch 部分）已清理
- [x] `DataStatusBanner` 通用 retry 保留，admin refreshing 相关状态已清理
- [x] 后端 `POST /api/admin/refresh` 路由已移除
- [x] `refreshTop100Snapshot.ts` 在 `hydrateMomentumSignals` 开头校验 H30269 日期 ≥ 参考日期
- [x] `refreshRpsStyleSnapshots.ts` 在 `computeRpsStyleDataset` 前校验 H30269 日期 ≥ `endDate10`
- [x] 校验不通过时日志记录原因并 exit 0（静默跳过，不写数据），工作流标记为成功
- [x] 下次 LowVol 完成后 Top200 和 RPS Style Snapshots 会自动再次触发
- [x] Top200 和 RPS Style Snapshots 的 `workflow_dispatch` 仍可用于紧急手动触发
- [x] TypeScript 编译通过，无未使用变量/导入报错
- [x] ETF200 列表页、动量分析页、RPS 总览页三者数据一致
