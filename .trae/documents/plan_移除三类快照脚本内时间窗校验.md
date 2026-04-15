# 计划：移除三类快照脚本内时间窗校验

## 1. Summary
- 按你的决定，移除三类脚本中的“脚本内时间窗校验”，完全依赖 GitHub Actions `schedule` 作为唯一时间控制来源。
- 覆盖脚本：
  - `server/scripts/refreshRpsStyleSnapshots.ts`
  - `server/scripts/refreshLowVolSnapshots.ts`
  - `server/scripts/refreshValueTimingSnapshots.ts`
- 保留 `workflow_dispatch` 手动触发能力，不再需要 `*_IGNORE_WINDOW` 相关环境变量控制。

## 2. Current State Analysis
- 当前 RPS 脚本已包含时间窗判断（北京时间 19:30–23:59）：
  - `ignoreWindow` 读取 `RPS_REFRESH_IGNORE_WINDOW`
  - 窗外直接 `skipped` 返回。
- 低波与价值择时脚本也有同类逻辑（基于 `bjtHour` 判断）。
- GitHub workflow 本身已配置精确 `cron` 时间窗，且手动触发是独立 step（`workflow_dispatch`）。
- 现状导致“时间控制重复”，你希望简化为单一入口（workflow）。

## 3. Proposed Changes

### 3.1 移除三脚本内时间窗逻辑
- 修改文件：
  - `server/scripts/refreshRpsStyleSnapshots.ts`
  - `server/scripts/refreshLowVolSnapshots.ts`
  - `server/scripts/refreshValueTimingSnapshots.ts`
- 变更内容：
  - 删除 `ignoreWindow` 相关环境变量读取。
  - 删除 `nowBjtHour` / `nowBjtHourMinute` 与时间窗判断分支。
  - 删除 `outside_refresh_window` 的 `skipped` 输出路径。
  - `main()` 进入后直接执行刷新逻辑。

### 3.2 清理 workflow 中无效窗口变量
- 修改文件：
  - `.github/workflows/refresh-rps-style-snapshots.yml`
  - 若存在对应 lowvol/value workflow，也同步清理
- 变更内容：
  - 删除 `RPS_REFRESH_IGNORE_WINDOW`（以及 lowvol/value 对应变量，若存在）。
  - 保留现有 `schedule` 和 `workflow_dispatch` 结构不变。

### 3.3 可观测性保持
- 移除脚本内窗口后，日志中不再出现 `outside_refresh_window`。
- 失败/回退日志与质量摘要逻辑保持原样（避免影响故障定位）。

## 4. Assumptions & Decisions
- 已确认：改动范围为三类脚本（RPS + 低波 + 价值择时）统一移除校验。
- 已确认：时间控制权完全交给 GitHub workflow（cron + 手动触发）。
- 不新增新的运行开关，保持链路简洁。

## 5. Verification Steps
- 代码验证：
  - 三个脚本均不再包含 `outside_refresh_window` 分支与 `IGNORE_WINDOW` 变量判断。
- 行为验证：
  - 手动触发 workflow 时脚本必定执行，不再因时间窗 `skipped`。
  - 定时触发时间仅由 workflow `cron` 决定。
- 工程验证：
  - `npm run build` 通过。
  - `GetDiagnostics` 检查三脚本无新增错误。
