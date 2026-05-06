# Tasks

* [x] Task 1: 复核两张告警表的真实访问模型

  * [x] 梳理 `value_timing_meta` 与 `rps_style_meta` 的创建迁移、读接口、发布函数与调用角色

  * [x] 确认 Security Advisor 告警是否为真实安全缺口，而不是可忽略提示

  * [x] 明确前台是否依赖匿名读取默认元数据行

* [x] Task 2: 设计最小权限修复方案

  * [x] 为两张 `*_meta` 表定义 RLS 开启策略

  * [x] 设计 `select` policy，仅允许读取 `id='default'` 的默认元数据行

  * [x] 确认写权限仍只保留给 `service_role` 与现有 `security definer` 发布函数

* [x] Task 3: 落地 Supabase migration 与必要代码调整

  * [x] 新增 migration：对 `public.value_timing_meta` 与 `public.rps_style_meta` 执行 `enable row level security`

  * [x] 新增/更新 policy，避免匿名读链路回归

  * [x] 复核 `server/lib/supabaseRest.ts` 的读取方式是否需要同步收口

* [x] Task 4: 验证修复不会影响现有模块

  * [x] 校验 `readValueTimingMeta()` 在启用 RLS 后仍可返回默认元数据

  * [x] 校验 `readRpsStyleMeta()` 在启用 RLS 后仍可返回默认元数据

  * [x] 校验发布函数与 run 切换链路不受影响

* [ ] Task 5: 回归 Security Advisor 与交付结论

  * [ ] 验证 Supabase Security Advisor 不再出现这两个 `RLS Disabled in Public` error

  * [x] 输出最终结论：根因、影响面、推荐方案、可选更严格方案

# Task Dependencies

* Task 2 depends on Task 1

* Task 3 depends on Task 2

* Task 4 depends on Task 3

* Task 5 depends on Task 4

