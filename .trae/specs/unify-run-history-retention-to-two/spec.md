# 四模块 Run 保留数统一降至 2 Spec

## Why
当前大盘看板、低波机会、价值择时、市场风格 RPS 四个模块的 run 保留策略虽已统一为 5，但会持续放大 Supabase 点位表体积，尤其是低波模块的 `lowvol_index_point` 已明显偏大。将四模块统一降为保留最近 2 个 run，可以在保留基础回退能力的同时明显降低存储占用，并保持运维口径一致。

## What Changes
- 将大盘看板、低波机会、价值择时、市场风格 RPS 的 run 保留上限统一从 5 降为 2
- 保持四模块现有的原子发布模型不变，仅调整 `history_run_ids` 截断长度、`previous_run_id` 派生规则与旧 run 清理范围
- 为四模块补充一次性清理方案：将现存 `history_run_ids` 收缩到最近 2 个 run，并删除对应点位表中不再保留的旧 run 数据
- 保持前端与 API 返回结构不变，只允许读取当前 run 与上一个 run

## Impact
- Affected specs: market-board-run-model, lowvol-run-model, value-timing-run-model, rps-run-model
- Affected code: `server/scripts/refreshMarketBoardPoints.ts`, `server/scripts/refreshLowVolSnapshots.ts`, `server/scripts/refreshValueTimingSnapshots.ts`, `server/scripts/refreshRpsStyleSnapshots.ts`, `server/lib/supabaseRest.ts`, `supabase/migrations`

## ADDED Requirements
### Requirement: 四模块统一 Run 保留上限
系统 SHALL 将大盘看板、低波机会、价值择时、市场风格 RPS 四个模块的 run 保留上限统一为最近 2 个 run。

#### Scenario: 发布成功后仅保留 2 个 run
- **WHEN** 任一模块成功发布一个新的可见 run
- **THEN** 该模块的 `history_run_ids` 仅保留 `[current_run_id, previous_run_id]` 两个 run
- **THEN** 若历史 run 少于 2 个，则仅保留实际存在的 run
- **THEN** `previous_run_id` 必须等于保留列表中的第二个 run；若不存在第二个 run，则写为 `null`

### Requirement: 发布后立即清理旧 Run 数据
系统 SHALL 在元数据切换完成后，仅保留最近 2 个 run 对应的点位数据。

#### Scenario: 清理非保留 run
- **WHEN** 任一模块完成原子发布
- **THEN** 对应点位表中所有不在保留列表内的 run 数据都被删除
- **THEN** 公共读取策略只暴露当前 run 与上一个 run

### Requirement: 历史数据一次性收缩
系统 SHALL 提供一次性迁移，将现有 run 历史收缩到最近 2 个 run，而无需等待下一次夜间任务自然淘汰。

#### Scenario: 迁移执行后历史 run 收缩
- **WHEN** 迁移在已有生产数据的环境执行
- **THEN** 四个模块各自的 `history_run_ids` 被裁剪到最近 2 个 run
- **THEN** 四个模块各自点位表中的非保留 run 数据被删除
- **THEN** 当前可见 run 不发生切换

## MODIFIED Requirements
### Requirement: Run 回退读取范围
系统 SHALL 在所有 run 化模块中，仅允许基于最近 2 个 run 执行读取和回退，不再依赖更深的历史 run。

#### Scenario: 当前 run 读取异常时回退
- **WHEN** 读取当前 run 失败或结果为空，且上一个 run 仍存在
- **THEN** 系统仅回退到上一个 run
- **THEN** 系统不得继续尝试更早的第三个及以上历史 run

### Requirement: 统一运维口径
系统 SHALL 将四模块 run 保留策略统一定义为“当前 run + 上一个 run”，避免单模块独立漂移回更大的保留数量。

#### Scenario: 新增或调整模块脚本常量
- **WHEN** 开发者调整任一模块的 run 发布脚本
- **THEN** run 保留上限仍应遵循统一值 2
- **THEN** 若未来要变更该策略，应作为跨模块统一变更处理

## REMOVED Requirements
### Requirement: 保留最近 5 个 run
**Reason**: 该策略占用存储较高，且超出当前需要的基础回退能力。
**Migration**: 通过迁移裁剪 `history_run_ids` 到最近 2 个 run，并删除点位表中不再保留的旧 run 数据。
