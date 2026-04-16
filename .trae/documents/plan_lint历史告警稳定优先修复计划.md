# Lint历史告警稳定优先修复计划

## Summary
- 目标：在不影响业务稳定性的前提下，优先清理全仓 ESLint `error` 级问题，使 `npm run lint` 至少达到“无 error（可保留 warning）”。
- 范围：仅处理当前 `error`，不主动处理全量 warning（按已确认偏好）。
- 策略：`no-explicit-any` 统一采用“`unknown + 类型守卫`”替代，不使用 `eslint-disable` 作为主路径。
- 约束：避免改动核心业务流程与数据口径；优先小步、可回归验证的重构顺序。

## Current State Analysis

### 1) 规则基线
- 配置文件：`eslint.config.js`
- 现状：启用 `@typescript-eslint/recommended` 与 `react-hooks/recommended`，因此 `no-explicit-any` 与 `no-unused-vars` 为主要错误来源，hooks 依赖告警为主要 warning 来源。

### 2) Error 主要分布（按风险与数量）
- 高数量区：
  - `server/scripts/refreshMarketBoardPoints.ts`：大量 `no-explicit-any`
  - `server/lib/valueTiming.ts`：多处 `no-explicit-any`
- 中数量区：
  - `server/lib/lowVol.ts`：`no-explicit-any` + 局部 `no-unused-vars`
- 零散区：
  - `server/lib/chinamoneyGovBond.ts`
  - `server/lib/csindexIndexValuation.ts`
  - `server/lib/marketBoardSupabaseService.ts`
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/scripts/checkCsindexData.ts`
  - `server/scripts/refreshLowVolSnapshots.ts`
  - `server/tests/csindexIndexValuation.test.ts`
  - `server/tests/valueTimingResilience.test.ts`

### 3) 稳定性风险判断
- 运行时核心链路文件（`valueTiming.ts`、`lowVol.ts`、`marketBoardSupabaseService.ts`）需最谨慎：类型收紧必须保持行为等价。
- 脚本与测试文件风险相对可控，可在核心链路收敛后清理。
- warning（hooks 依赖）不在本轮强制范围，避免引入前端行为变化。

## Proposed Changes

### Phase A：先清低风险 `no-unused-vars`（最小改动）
- 文件：
  - `server/lib/lowVol.ts`
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/scripts/refreshLowVolSnapshots.ts`
- 做法：
  - 删除或内联未使用局部变量；
  - 如变量仅用于断言日志，改为明确使用或移除死代码。
- 目标：快速减少噪音，降低后续 lint 回归干扰。

### Phase B：核心库 `any -> unknown`（稳定优先）
- 文件：
  - `server/lib/valueTiming.ts`
  - `server/lib/lowVol.ts`
  - `server/lib/marketBoardSupabaseService.ts`
  - `server/lib/chinamoneyGovBond.ts`
  - `server/lib/csindexIndexValuation.ts`
- 做法：
  - 将 `as any` 替换为 `unknown` / `Record<string, unknown>` / 显式接口；
  - 抽取复用守卫函数（如 `isRecord`、`asArray`、`toNum`）进行字段访问收敛；
  - 对外部 API JSON 解析处统一“判空 + 类型收窄”模板，避免隐式类型逃逸。
- 稳定性控制：
  - 不改原有业务分支条件与默认值语义；
  - 保留原异常信息与兜底路径。

### Phase C：脚本与测试文件 `any` 清理
- 文件：
  - `server/scripts/refreshMarketBoardPoints.ts`
  - `server/scripts/checkCsindexData.ts`
  - `server/tests/csindexIndexValuation.test.ts`
  - `server/tests/valueTimingResilience.test.ts`
- 做法：
  - 为脚本输入输出定义轻量结构体；
  - 将对象访问改为 `Record<string, unknown>` + 守卫；
  - 测试中使用最小必要类型别名替代 `any`。
- 说明：脚本保持运行参数与输出格式不变。

### Phase D：逐文件回归收敛
- 每完成一个文件簇即执行：
  - `npm run check`
  - `npm run lint`（确认 error 下降趋势）
- 若出现行为风险，立即在当前文件簇内回退实现方式（不扩大改动面）。

## Assumptions & Decisions
- 决策：本轮只清 `error`，warning 暂不纳入硬目标。
- 决策：`no-explicit-any` 统一用 `unknown + 类型守卫`，不以 `eslint-disable` 作为常规手段。
- 决策：先核心库后脚本测试，确保业务读写链路稳定优先。
- 假设：现有单测与 `npm run check` 可覆盖主要类型回归风险，但仍需脚本级人工冒烟。

## Verification Steps
- 静态验证：
  - `npm run check` 通过；
  - `npm run lint` 达到 0 error（warning 允许保留）。
- 冒烟验证（稳定性）：
  - API 关键读路径：低波、价值、大盘、RPS 页面数据可正常返回；
  - 脚本关键路径：`refreshMarketBoardPoints` 可完成一次干跑或最小范围执行（只读/受控环境）。
- 交付验证：
  - 输出“剩余 warning 清单”与“本轮已清 error 清单”，明确后续可选优化项。

## Out Of Scope
- 不处理 hooks 依赖类 warning 的全面整改；
- 不改业务口径、发布机制、数据库结构；
- 不做大规模重构（如拆分文件、改架构层次）。
