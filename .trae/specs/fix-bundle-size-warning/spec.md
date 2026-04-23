# 修复 Bundle Size Warning Spec

## Why
当前前端 `npm run build` 会持续出现 Vite 的 chunk size warning，说明主包或 legacy 包体积过大，已经影响构建输出质量，也会增加首屏加载和后续维护成本。
本次需要通过合理分包和按需加载来消除 warning，而不是简单调高告警阈值掩盖问题。

## What Changes
- 为前端路由页面引入按需加载，避免所有页面都被打进首屏主包
- 在 Vite 构建配置中补充明确的手动分包策略，拆分体积较大的公共依赖或高成本页面代码
- 保持现有路由路径、登录守卫、开发页入口和页面行为不回退
- 以 `npm run build` 不再出现 chunk size warning 作为主要验收目标
- 不采用单纯调高 `chunkSizeWarningLimit` 的方式规避问题，除非作为辅助配置且 warning 实际已因分包消失

## Impact
- Affected specs: 前端构建体积控制、路由加载策略、Vite 打包输出
- Affected code: `src/App.tsx`、可能的页面懒加载封装、`vite.config.ts`

## ADDED Requirements
### Requirement: 构建产物需消除 chunk size warning
系统 SHALL 通过真实的代码拆分和分包优化，使前端生产构建不再出现 Vite 的 chunk size warning。

#### Scenario: 执行生产构建
- **WHEN** 开发者运行 `npm run build`
- **THEN** 构建日志中不应再出现 chunk size warning
- **AND** 该结果应来自实际分包优化，而不是仅通过抬高 warning 阈值隐藏问题

### Requirement: 页面路由需支持按需加载
系统 SHALL 对前端页面路由采用按需加载策略，降低默认主包体积。

#### Scenario: 应用初始化
- **WHEN** 用户首次打开应用
- **THEN** 非当前访问页面不应全部同步进入首屏主包
- **AND** 现有路由路径、登录守卫和开发路由行为必须保持不变

### Requirement: 构建配置需具备稳定分包策略
系统 SHALL 在构建配置中定义稳定且可维护的分包策略，以降低单个 chunk 体积并避免未来轻微迭代再次立刻触发 warning。

#### Scenario: 打包公共依赖与大页面模块
- **WHEN** Vite 生成生产构建产物
- **THEN** 体积较大的公共依赖或高成本页面代码应被拆分到更合理的 chunk
- **AND** 分包规则应清晰、可读、可维护

## MODIFIED Requirements
### Requirement: 前端构建质量
系统 SHALL 将“构建成功”的标准从仅能生成产物，提升为“能生成产物且无 chunk size warning”，从而把包体积控制纳入前端构建质量基线。

#### Scenario: 本地或 CI 构建
- **WHEN** 执行标准前端构建
- **THEN** 除非出现与本次任务无关的既有异常，否则构建应在无 chunk size warning 的情况下完成

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次需求为构建质量优化，不涉及移除既有业务能力。
**Migration**: 无需迁移。
