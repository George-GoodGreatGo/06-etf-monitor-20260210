# RPS 自定义查询改为实时中文名查询 Spec

## Why
当前非预置 ETF 中文名在线上可用，主要依赖静态名称快照兜底；这能解决问题，但不符合“用户每次输入代码都实时查询数据源获取中文名”的产品逻辑，也会带来快照老化的维护成本。与此同时，线上环境不能运行 Python，因此新方案必须在不依赖 Python 子进程的前提下，提供本地与线上统一的实时名称查询链路。

## What Changes
- 将 RPS 自定义查询的非预置 ETF 中文名解析主路径改为实时 HTTP 数据源查询，不再以静态名称快照作为主逻辑
- 选择一个线上与本地都可访问、且不依赖 Python 的 ETF 名称数据源，按 `code -> 中文名` 实时解析
- 保留已维护的 RPS 预置标的名称作为最高优先级，避免已知标的被外部数据源覆盖
- 明确当实时名称源失败时的最小降级行为：允许只显示代码，但不得伪造旧快照名称
- 评估并收敛当前为排查而引入的冗余逻辑，尤其是静态名称快照主路径与 `requestId` 参数化触发
- 增补严格回归验证，覆盖本地环境、模拟线上环境以及真实页面查询路径

## Impact
- Affected specs: `市场风格RPS自定义查询`
- Affected code: `server/lib/rpsStyle.ts`, `server/lib/akshare.ts`, `server/tests/rpsStyleCustomQuery.test.ts`, `src/components/RpsStylePanel.tsx`, `src/utils/marketApi.ts`

## ADDED Requirements
### Requirement: 非预置 ETF 中文名实时查询
系统 SHALL 在用户提交非预置 ETF 代码时，通过线上与本地都可用的实时 HTTP 数据源查询该 ETF 中文名，而不是依赖预生成静态名称快照作为主查询路径。

#### Scenario: 非预置 ETF 查询成功返回中文名
- **WHEN** 用户输入一个不在 RPS 预置列表中的 ETF 代码
- **THEN** 服务端实时调用统一的 HTTP 数据源解析中文名
- **AND** 接口返回的 `name` 为实时查询到的中文名称
- **AND** 前端摘要区与图表说明位置直接展示中文名称与代码

#### Scenario: 实时名称源失败时最小降级
- **WHEN** 实时名称源超时、失败或未返回有效中文名
- **THEN** 系统允许仅展示代码
- **AND** 不得再依赖过期静态快照伪造名称
- **AND** 页面应保持查询结果其余部分可用

### Requirement: 线上环境不依赖 Python 获取中文名
系统 SHALL 在 Vercel 等无法调用本机 Python 的线上环境中，仍可完成非预置 ETF 中文名解析。

#### Scenario: 模拟线上环境解析中文名
- **WHEN** 系统运行在 `VERCEL` 环境变量为真或等价的 Serverless 环境
- **THEN** 非预置 ETF 中文名解析链路不调用 Python 子进程
- **AND** 仍可通过统一的 HTTP 数据源返回中文名

## MODIFIED Requirements
### Requirement: 自定义查询名称解析优先级
系统 SHALL 统一自定义查询的名称解析优先级为：`RPS 预置名称 > 实时 HTTP 名称源 > 代码降级`。静态名称快照不得继续作为线上主路径，也不得成为默认长期兜底。

#### Scenario: 预置 ETF 不被外部名称覆盖
- **WHEN** 用户查询已维护在 RPS 预置列表中的 ETF
- **THEN** 返回结果继续优先使用预置中文名
- **AND** 不因实时 HTTP 名称源的别名或简称差异而改变既有展示口径

#### Scenario: 非预置 ETF 统一走实时 HTTP 名称源
- **WHEN** 用户查询非预置 ETF，且本地与线上环境都可访问该实时 HTTP 名称源
- **THEN** 本地与线上返回一致的名称解析结果
- **AND** 不再出现“本地实时查、线上靠电话本”的双轨差异

### Requirement: 自定义查询交互触发保持清晰
系统 SHALL 保持“每次点击查询都发起一次新的实时请求”的用户感知，并尽量收敛为最小必要的前端触发逻辑。

#### Scenario: 同一代码重复查询仍重新发起请求
- **WHEN** 用户连续两次查询同一个 ETF 代码
- **THEN** 前端仍会发起新的实时查询请求
- **AND** 不因 state 未变化而跳过查询
- **AND** 实现方式应避免引入无业务含义的冗余参数

## REMOVED Requirements
### Requirement: 静态 ETF 名称快照作为线上主路径
**Reason**: 不符合“每次输入都实时查询”的产品逻辑，且会引入快照更新债务与本地/线上行为分叉。  
**Migration**: 用统一的实时 HTTP 名称源替代静态快照主路径；仅在明确批准的情况下才允许保留极小范围的临时兜底。
