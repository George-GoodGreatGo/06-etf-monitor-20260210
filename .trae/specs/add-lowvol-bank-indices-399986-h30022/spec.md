# 低波机会：新增银行指数（399986 / H30022）Spec

## Why
当前“低波机会”支持的指数不包含银行主题指数，导致无法在同一套低波/利差/偏离度口径下观察银行板块的阶段性机会。需要补充两个常用银行指数，并补齐其全收益（TRI）指数映射，确保所有指标均基于真实数据而非推测值。

## What Changes
- 在低波机会支持指数列表中新增两项：
  - 中证银行指数 PRI：`399986`，TRI：`H20180`
  - 中证800银行指数 PRI：`H30022`，TRI：`H20022`
- 前端指数选择器/下拉选项中展示上述两项，并可正常切换、加载、展示图表与信号。
- 定时快照刷新与 Supabase 存储逻辑保持不变：新增指数自动进入晚间队列刷新。

## Impact
- Affected specs: 低波机会（支持指数清单/选择器）
- Affected code:
  - `server/lib/lowVol.ts`：扩展 `LOWVOL_INDEXES` 配置（priCode/triCode/name）
  - `src/pages/Home.tsx` 或 `src/components/LowVolOpportunityPanel.tsx`：扩展前端指数选项列表（label/desc/code）
  - `server/scripts/refreshLowVolSnapshots.ts`：无需改动（读取支持清单后自动覆盖）

## ADDED Requirements
### Requirement: 新增支持指数
系统 SHALL 在低波机会支持指数中新增银行相关指数，并支持拉取 PRI/TRI。

#### Scenario: 中证银行指数
- **WHEN** 用户选择指数 `399986`
- **THEN** 系统使用 PRI=`399986` 与 TRI=`H20180` 的真实数据计算并展示图表与指标

#### Scenario: 中证800银行指数
- **WHEN** 用户选择指数 `H30022`
- **THEN** 系统使用 PRI=`H30022` 与 TRI=`H20022` 的真实数据计算并展示图表与指标

## MODIFIED Requirements
### Requirement: 支持指数白名单
系统 SHALL 将低波机会白名单扩展包含 `{399986, H30022}`（及其既有指数），并确保：
- `/api/lowvol/index/:code` 支持读取对应指数的快照与展示
- 定时刷新任务会覆盖新增指数并写入 Supabase 快照

## REMOVED Requirements
无

