# 重构“价值择时”模块实施计划

## Summary
- 目标：将“价值择时”模块升级为与“低波机会”**页面内容与交互完全同构**，仅保留一个核心口径差异：`利差=盈利收益率(=1/PE)-10Y`，并以该利差做 5 年滚动分位与操作建议。
- 指数范围：价值择时仅保留 `932365 / 932315 / 980081`；低波机会模块保持现状，不移除这 3 个指数。
- 数据链路：价值择时后端改造成与低波机会一致的 `run_id + 原子发布 + 保留5次run + 失败回退` 模式。
- 估值源策略：`932365/932315` 使用中证官方估值接口；`980081` 优先公开估值 API，若历史覆盖不足则回退到 `159263` ETF PE 并在前端显著提示“替代口径+ETF代码”。

## Current State Analysis
- 前端形态差异：
  - `src/components/ValueTimingPanel.tsx` 与 `src/components/charts/ValueTimingChart.tsx` 当前仅双图（指数+利差分位），缺少低波机会的全套交互（SMA60/SMA250 开关、BIAS基准切换、BIAS/BIAS分位/利差/利差分位多面板、分段建议色带、右侧悬浮切换等）。
  - `src/pages/Home.tsx` 当前仅为低波模块提供 `biasBasis` 悬浮切换；价值择时未接入该交互。
- 后端数据结构差异：
  - `server/lib/valueTiming.ts` 当前输出字段较少（close/pe/earningsYield/y10/spread/rank），未计算 `SMA60/SMA250/BIAS/BIAS分位`。
  - 当前价值择时读取 `value_timing_index_daily` 快照表（`server/lib/supabaseRest.ts`），不是低波同款 run 发布模型。
  - 刷新脚本 `server/scripts/refreshValueTimingSnapshots.ts` 仍是逐指数快照 upsert，不是“整批校验后原子切换”。
- 数据源现状：
  - `932365/932315` 已通过中证 `indexCsiDsPe` 获取 PE（`server/lib/csindex.ts`）。
  - `980081` 目前是 ETF 代理口径且沿用旧映射（非本次目标），需切换为“公开估值源优先、159263兜底”的明确策略。
- 发布工作流现状：
  - `refresh-value-timing-snapshots.yml` 目前与 run 发布策略不一致，且未体现“窗口化+回退语义”。

## Proposed Changes

### 1) 数据库与发布模型迁移（价值择时对齐低波 run 模型）
- 新增迁移：`supabase/migrations/0012_value_timing_run_model.sql`
- 变更内容：
  - 新建 `public.value_timing_index_point`（主键：`run_id, code, data_date`），字段对齐价值择时所需完整指标：`close, ma60, ma250, bias60, bias250, bias_pct_3y_60, bias_pct_3y, pe, earnings_yield_pct, yield10y_pct, spread_pct, spread_pct_rank_5y` 等。
  - 新建 `public.value_timing_meta`（保存 `current_run_id / previous_run_id / history_run_ids / current_data_date / publish_status / quality_summary`）。
  - 新增 RPC：`publish_value_timing_run(...)`，用于原子切换 current run、维护历史 run、清理非保留 run。
  - RLS 策略与 lowvol 同类：匿名仅可读 current/history run。
- 原因：满足“与低波机会同类的稳定发布链路”与失败回退要求，避免部分写入导致前端看到半成品。

### 2) Supabase 访问层扩展（value run 读写）
- 修改文件：`server/lib/supabaseRest.ts`
- 新增/改造：
  - `readValueTimingMeta()`
  - `readValueTimingIndexPointsRange({ code, startDate, endDate, runId? })`
  - `upsertValueTimingIndexPoints(rows)`
  - `publishValueTimingRun(args)`
  - 保留旧 `value_timing_index_daily` 读接口作为短期兼容回退（仅迁移过渡期使用）。
- 原因：把 value 读取路径切到 run 表，且保留短期兼容，降低切换风险。

### 3) 价值择时核心计算升级（补齐低波同款指标）
- 修改文件：`server/lib/valueTiming.ts`
- 变更内容：
  - 将 `ValueTimingDailyPoint` 扩展为低波同构字段集：
    - 价格与均线：`close, ma60, ma250`
    - 乖离与分位：`bias60, bias250, biasPct3y60, biasPct3y`（窗口 5 年≈1260，minPeriods=252）
    - 估值与利差：`pe, earningsYieldPct, yield10yPct, spreadPct, spreadPctRank5y`
  - 建议规则改为低波同款判定逻辑（仅利差口径换为盈利收益率）：
    - 偏减仓：`BIAS分位(5y) >= 85`
    - 偏加仓/偏持有/偏观望规则沿 lowvol 阈值体系（80/20/85）和状态机。
  - 快照读取逻辑改为优先 run 表（类似 `getLowVolIndexSeriesFromSupabaseRuns` 的可用 run 选择、stale 校验、fallback 原因记录）。
- 原因：满足“页面与交互同构”对字段完整性的硬要求，且建议口径与新利差分位一致。

### 4) 估值数据源重构（公开API优先 + 159263兜底）
- 修改文件：
  - `server/lib/valueTiming.ts`
  - `server/lib/csindex.ts`（必要时增强重试与校验）
  - `server/lib/akshare.ts`、`server/python/akshare_service.py`（新增估值抓取子命令）
  - `server/lib/baostock.ts`、`server/python/baostock_service.py`（作为可选补充源）
- 目标策略（按指数）：
  - `932365 / 932315`：主源 `csindex indexCsiDsPe`（官方）；失败时可接入 AkShare/其他公开源作为补偿。
  - `980081`：优先公开估值 API（先实现可稳定拉取的主源）；若历史覆盖不足，则 fallback 到 `159263` ETF PE。
- 输出与可追溯：
  - 在 `meta.notes`/run quality 中记录每段区间实际使用的 source、覆盖率、fallback 原因、是否触发 ETF 替代。
  - 前端可读取并展示“当前指数是否处于 ETF 替代口径、替代 ETF=159263”。
- 原因：满足“稳定、免费、公开 API”要求，并在不可避免缺口时按你确认的策略自动替代。

### 5) 刷新脚本升级为 full_backfill + 原子发布
- 修改文件：`server/scripts/refreshValueTimingSnapshots.ts`
- 改造方向：
  - 对齐 lowvol 脚本结构：`FULL_BACKFILL_START=20160101`、`RUN_HISTORY_KEEP=5`、覆盖率与 stale 校验、分批 upsert、最终 `publishValueTimingRun(...)` 原子切换。
  - 任一关键校验失败：不发布新 run，保留上次可见 run，并写失败状态到 meta。
- 原因：把 value 链路与 lowvol 链路完全对齐，满足稳定性和快速回退。

### 6) Workflow 对齐 lowvol 策略
- 修改文件：`.github/workflows/refresh-value-timing-snapshots.yml`
- 变更内容：
  - 调整为与 lowvol 一致的窗口化调度与手动触发语义（含 `IGNORE_WINDOW`）。
  - 使用新 run 发布脚本执行路径。
  - 保留网络稳态参数（IPv4 优先、重试参数）。
- 原因：降低外部 API 波动对 nightly 发布成功率的影响。

### 7) 前端“价值择时”同构改造
- 修改文件：
  - `src/components/ValueTimingPanel.tsx`
  - `src/components/charts/ValueTimingChart.tsx`
  - `src/pages/Home.tsx`
  - `src/utils/marketApi.ts`
  - `src/utils/valueTimingSignal.ts`
- 变更内容：
  - 价值择时卡片区、图表区、hover、图例、分段着色、按钮矩阵、加载态与 DataStatusBanner 行为，全部对齐低波机会。
  - 增加 value 专属 `BIAS基准` 悬浮切换（SMA250/SMA60）并联动：
    - BIAS/BIAS分位展示
    - 操作建议计算
    - 主图分段色带
  - 指标文案统一为“盈利收益率口径利差”，显著提示：
    - 仅当 `980081` 触发 fallback 时展示“ETF替代口径（159263）”标签。
  - value summary 卡片建议规则从旧 `spreadPctRank5y` 单因子改为“低波同款双因子（利差分位+BIAS分位）”。
- 原因：满足“所有内容与交互完全一致”的前端要求，同时保留唯一口径差异。

### 8) 路由与类型同步
- 修改文件：
  - `server/routes/value.ts`
  - `src/utils/marketApi.ts`
- 变更内容：
  - 接口返回字段扩展为同构模型。
  - 保持 URL 不变（`/api/value/index/:code`, `/api/value/summary`），减少前端路由层改动风险。

### 9) 测试与回归补齐
- 修改/新增：
  - `server/tests/valueTimingFormula.test.ts`
  - `server/tests/valueTimingResilience.test.ts`
  - 新增 `server/tests/valueTimingRunPublish.test.ts`（建议）
  - 新增 `server/tests/valueTimingSignalRule.test.ts`（建议）
- 覆盖重点：
  - `earningsYield = 100/PE` 与新利差正确性。
  - BIAS/BIAS分位与 5年窗口边界。
  - `980081` 主源缺口触发 `159263` fallback 的 notes 与状态标记。
  - run 发布原子切换、失败回退、保留5个 run。

## Assumptions & Decisions
- 已确认决策：
  - `980081` 公开估值源不足时，允许使用 `159263` ETF PE 替代，且前端必须显著提示。
  - `932365/932315/980081` 在低波机会模块继续保留，不做删除。
- 实施假设：
  - 现有 Supabase 权限与 migration 权限可新增 `value_timing_*` 新表/RPC。
  - 当前前端允许新增 value 侧 `biasBasis` 状态，不影响其他 tab。
  - 公开 API 存在波动，最终以“多源优先级 + run级校验”保障可用性，而不是依赖单源 100% 成功。

## Verification Steps
- 后端静态校验：
  - TypeScript 编译与 lint 通过（重点检查 `server/lib/valueTiming.ts`、`supabaseRest.ts`）。
- 单测：
  - 运行 value 相关测试，验证公式、分位、fallback、run 发布行为。
- 数据链路联调：
  - 手动运行 value 刷新脚本一次，验证：
    - 生成新 run 并原子切换；
    - `history_run_ids` 保留 5 次；
    - `980081` 在主源缺口时写入 `159263` fallback 标记。
- 前端验收：
  - `/market?tab=value` 下逐项对照低波机会：
    - 卡片交互、悬浮 BIAS 切换、图表面板开关、hover 信息、建议标签一致；
    - 唯一差异为利差定义文案与替代口径提示。
- 回退演练：
  - 模拟本次 run 校验失败，确认仍展示上一可见 run 数据且 API 返回可读失败说明。
