# Supabase 元数据表 RLS 告警排查与修复 Spec

## Why
Supabase Security Advisor 当前对 `public.rps_style_meta` 与 `public.value_timing_meta` 报出 `RLS Disabled in Public` 错误。经代码与迁移核对，这不是误报，而是两张位于 `public` schema 的元数据表在创建后未开启 RLS，和同链路的 `*_point` 表安全模型不一致，需要补齐最小权限控制并避免影响现有读链路。

## What Changes
- 复核 `rps_style_meta` 与 `value_timing_meta` 的实际用途、调用方与鉴权方式，确认其属于“发布 run 元数据表”而非前台自由查询表。
- 为两张 `*_meta` 表补充 RLS 开启与显式只读策略，消除 Security Advisor 错误。
- 采用最小权限方案：仅允许读取 `id='default'` 的发布元数据行；写入与更新继续通过 `service_role` / `security definer` 函数完成。
- 校验并补强服务端读链路，确保启用 RLS 后 `readValueTimingMeta()` 与 `readRpsStyleMeta()` 不发生行为回归。
- 增加针对迁移与读取行为的验证，确保 Supabase Advisor 不再提示这两个 error。

## Impact
- Affected specs:
  - `add-value-timing-module`
  - `add-market-rps-custom-query`
  - `unify-run-history-retention-to-two`
- Affected code:
  - `supabase/migrations/0012_value_timing_run_model.sql`
  - `supabase/migrations/0013_rps_run_model.sql`
  - 新增一条 Supabase migration（仅用于补齐 RLS / policy）
  - `server/lib/supabaseRest.ts`
  - 相关测试与验证脚本

## ADDED Requirements
### Requirement: 元数据表必须启用 RLS
系统 SHALL 对 `public.value_timing_meta` 与 `public.rps_style_meta` 启用 Row Level Security，且不得再以“未启用 RLS”的状态暴露在 `public` schema 下。

#### Scenario: Security Advisor 扫描元数据表
- **WHEN** Supabase Security Advisor 扫描数据库对象
- **THEN** `public.value_timing_meta` 不再报 `RLS Disabled in Public`
- **AND** `public.rps_style_meta` 不再报 `RLS Disabled in Public`

### Requirement: 元数据表只允许最小范围公开读取
系统 SHALL 仅允许受控读取当前发布批次所需的默认元数据行，不得为整表开放宽泛匿名访问。

#### Scenario: 前台或匿名只读链路读取默认元数据
- **GIVEN** 读取方仅需要当前发布 run 的元数据
- **WHEN** 调用方查询 `id='default'`
- **THEN** 系统允许读取该默认行
- **AND** 仅暴露当前链路实际依赖的元数据内容

#### Scenario: 查询非默认元数据行
- **WHEN** 调用方尝试读取 `id<>'default'` 的元数据行
- **THEN** 系统拒绝返回数据

### Requirement: 元数据写链路继续保持服务端专用
系统 SHALL 保持 `publish_value_timing_run()` 与 `publish_rps_run()` 对元数据表的写权限只在服务端链路可用，不得因补齐 RLS 而放宽写权限。

#### Scenario: 发布新 run
- **WHEN** 服务端发布脚本调用对应 `publish_*_run()` 函数
- **THEN** 元数据表可以完成更新
- **AND** 匿名角色不得获得 insert/update/delete 权限

### Requirement: 启用 RLS 后读取行为不得回归
系统 SHALL 在启用 RLS 后保持现有 run 元数据读取行为稳定。

#### Scenario: 服务端读取 value timing 元数据
- **WHEN** `readValueTimingMeta()` 查询默认元数据
- **THEN** 返回结果仍包含 `current_run_id`、`previous_run_id`、`history_run_ids`、`current_data_date`、`publish_status`、`quality_summary`
- **AND** 不因 RLS 改造而返回空结果或 401/403

#### Scenario: 服务端读取 RPS 元数据
- **WHEN** `readRpsStyleMeta()` 查询默认元数据
- **THEN** 返回结果仍包含 `current_run_id`、`previous_run_id`、`history_run_ids`、`current_data_date`、`publish_status`、`quality_summary`
- **AND** 不因 RLS 改造而返回空结果或 401/403

## MODIFIED Requirements
### Requirement: RPS 与价值择时发布元数据访问模型
RPS 与价值择时的发布元数据表必须与对应 `*_point` 表保持一致的安全模型：公开 schema 下的读取必须受 RLS 约束，匿名只读范围仅限默认发布元数据，写操作仅允许服务端链路执行。

## REMOVED Requirements
N/A
