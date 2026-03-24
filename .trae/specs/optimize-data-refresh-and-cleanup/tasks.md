# Tasks

- [x] 任务 1: 修改 GitHub Actions 调度时间
  - [x] 修改 `.github/workflows/refresh-top100.yml`，将 `cron: '0 11 * * 1-5'` 更改为 `cron: '0 14 * * 1-5'` (22:00 北京时间)。
- [x] 任务 2: 清理 `Home.tsx` 中的冷启动逻辑
  - [x] 移除 `bootIdRef` 和 `initialLoadDoneRef`。
  - [x] 移除第一个 `useEffect` 中获取 `/api/health` 并设置 `bootIdRef` 的逻辑。
  - [x] 移除主要的 `useEffect` (行 301-365) 中关于 `runInitial` 的定义和调用。
  - [x] 修改该 `useEffect`，使其在挂载时直接根据是否存在 `activeRefetchToken` 执行 `runFetch` 或执行默认的 `runFetch`。
- [x] 任务 3: 验证逻辑清理效果
  - [x] 检查 `Home.tsx` 挂载时是否不再请求 `/api/health`（已移除相关调用代码）。
  - [x] 验证页面加载时数据拉取是否依然正常工作。
