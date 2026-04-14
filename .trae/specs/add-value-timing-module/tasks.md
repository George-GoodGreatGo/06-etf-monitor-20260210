# Tasks
- [ ] Task 1: 新增“价值择时”导航与路由
  - [ ] SubTask 1.1: 更新 `src/components/SideNav.tsx`，在市场 Tab 列表中新增 `value`，标签为“价值择时”
  - [ ] SubTask 1.2: 更新 `src/pages/Home.tsx` 的 Tab 类型与解析逻辑，支持 `tab=value` 并渲染价值择时模块

- [ ] Task 2: 指数迁移与前端切换卡片
  - [ ] SubTask 2.1: 将 932365/932315/980081 从红利择时（低波机会）指数列表移除
  - [ ] SubTask 2.2: 新增价值择时指数列表（包含上述 3 支），并实现同等交互：卡片切换、建议标签、股息率/利差标签排版、展开/收起
  - [ ] SubTask 2.3: 在价值择时页面添加口径说明文案（盈利收益率 vs 股息收益率）

- [ ] Task 3: 新增价值择时 Supabase 表与读写接口
  - [ ] SubTask 3.1: 在 Supabase 创建独立表（建议：`value_timing_index_daily`），字段结构与 `lowvol_index_daily` 对齐（`code`,`data_date`,`snapshot_at`,`payload`,`source`,`source_type`,`notes`,`updated_at` 等），并配置 RLS 读取策略
  - [ ] SubTask 3.2: 扩展 `server/lib/supabaseRest.ts`，新增读写函数：读取最新快照（单 code / 多 code）与 upsert（按 `code,data_date` 冲突合并）

- [ ] Task 4: 价值择时后端计算与 API
  - [ ] SubTask 4.1: 新增 `server/lib/valueTiming.ts`（或等价模块），定义数据点结构：包含 `pe`、`earningsYieldPct`、`yield10yPct`、`spreadPct`、`spreadPctRank5y`、以及必要的价格/BIAS 指标（复用红利择时需要的部分）
  - [ ] SubTask 4.2: 实现 PE 数据源拉取：至少覆盖 932365/932315/980081，并对空数据/异常做严格校验
    - 932365/932315：使用中证口径的历史估值数据源（可直接获取历史 PE）
    - 980081：使用“推算口径”估值（默认基于跟踪 ETF：159605），并在快照写入 `source_type/source/notes` 说明推算来源
  - [ ] SubTask 4.3: 新增 API 路由 `GET /api/value/summary` 与 `GET /api/value/index/:code`（或等价命名），返回 meta + series，错误行为与 lowvol 保持一致（不返回空数组作为成功）

- [ ] Task 5: 独立 GitHub Actions nightly 快照任务
  - [ ] SubTask 5.1: 新增脚本 `server/scripts/refreshValueTimingSnapshots.ts`，逐指数计算并写入 `value_timing_index_daily`，日志输出需可观测（逐指数 start/done、耗时、错误原因）
  - [ ] SubTask 5.2: 新增 workflow `.github/workflows/refresh-value-timing-snapshots.yml`，定时运行并使用 service role key 写入（与 lowvol 工作流分离）

- [ ] Task 6: 前端价值择时图表与摘要区
  - [ ] SubTask 6.1: 新增价值择时面板组件（复用红利择时布局）：摘要区展示 `PE`、`盈利收益率`、`10Y`、`利差`、`利差分位(5年)`、`建议`
  - [ ] SubTask 6.2: 新增价值择时图表组件：主图为指数点位（可选），副图展示利差与分位分区（交互与红利择时一致）
  - [ ] SubTask 6.3: 对 980081 的 PE/盈利收益率展示增加“推算口径（基于跟踪ETF）”提示；当历史样本不足 5 年时，同位置合并提示样本期不足

- [ ] Task 7: 验证与回归
  - [ ] SubTask 7.1: 添加/更新单元测试（至少覆盖 `earningsYieldPct=100/PE` 与 `spreadPct=earningsYieldPct-yield10yPct`，以及分位窗口与 minPeriods 策略）
  - [ ] SubTask 7.2: 本地启动与手动验证：切换红利择时/价值择时、指数迁移、快照/错误状态展示正常

# Task Dependencies
- Task 4 depends on Task 3
- Task 5 depends on Task 3 and Task 4
- Task 6 depends on Task 1 and Task 4
