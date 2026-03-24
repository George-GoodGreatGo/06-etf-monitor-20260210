# 数据拉取调度优化及废弃逻辑清理

## Why
1. 提高数据及时性：将 19:00 的自动刷新任务推迟至 22:00，以便在多数 ETF 盘后成交数据完全确认后及时更新。
2. 代码清理：废弃并移除已不再使用的“页面冷启动/新会话校验”逻辑，简化首页数据加载流程，减少不必要的并发请求和本地存储占用。

## What Changes
- 修改 GitHub Actions 工作流配置：
    - 将 11:00 UTC (19:00 北京时间) 的任务修改为 14:00 UTC (22:00 北京时间)。
    - 保留 15:59 UTC (23:59 北京时间) 的任务。
- 重构 `Home.tsx`：
    - 移除 `runInitial` 异步逻辑。
    - 移除 `initialLoadDoneRef`、`bootIdRef` 等相关状态。
    - 简化 `useEffect` 挂载逻辑，直接执行常规数据获取。
    - 废弃 `etf_monitor_server_boot_id` 和相关锁机制的 `localStorage` 操作。

## Impact
- GitHub Actions：自动刷新时间点变更。
- 首页性能：减少冷启动时的额外健康检查和潜在的冗余刷新。
- 代码复杂度：降低数据加载链路的复杂度。

## ADDED Requirements
### Requirement: 优化定时任务
系统应在工作日 22:00 和 23:59 (北京时间) 各执行一次数据刷新。

#### Scenario: 定时刷新
- **WHEN** 时间到达北京时间 22:00
- **THEN** 触发 GitHub Actions 拉取最新数据并存入 Supabase

## MODIFIED Requirements
### Requirement: 首页加载逻辑
首页加载时应直接发起标准的数据获取请求，不再进行基于 Boot ID 的冷启动校验。

#### Scenario: 页面打开
- **WHEN** 用户首次打开或刷新页面
- **THEN** 仅触发一次常规的 `runFetch`，不再进行健康检查或冷启动刷新

## REMOVED Requirements
### Requirement: 页面冷启动校验
**Reason**: 逻辑已不再使用，且增加了前端复杂度和不必要的请求。
**Migration**: 直接移除 `Home.tsx` 中的相关代码和 `localStorage` 记录。
