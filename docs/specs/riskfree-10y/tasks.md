# 任务拆解（10Y国债收益率统一多源改造）

## P0 统一服务
- T1：新增 `server/lib/riskfree10yService.ts`
  - 定义统一返回类型、错误码、notes 结构和公共工具函数
- T2：抽象 provider 接口
  - `fetchRange({ startDate, endDate })`
  - 统一输出 `date/valuePct/source/observedAt/sourceDetail`
- T3：落地 `chinamoney` provider
  - 面向近端/当日确认
  - 独立超时、重试、UA、结构化错误
- T4：落地 `chinabond` provider
  - 迁移现有 `chinamoneyGovBond.ts`
  - 支持历史区间、按年缓存、解析异常识别
- T5：落地 `eastmoney` provider
  - 仅实现首版稳定可用能力，不引入额外收费或带 key 依赖
- T6：实现统一聚合器
  - 三源并发
  - 基础过滤
  - 20bp 双源确认规则
  - 单源严格兜底规则
- T7：实现统一日期对齐能力
  - 同日命中
  - 最近 7 日回看
  - 超窗返回空值
- T8：实现统一缓存能力
  - 日级 TTL
  - in-flight 去重
  - `forceRefresh=true` 禁止 stale fallback

## P0 模块接入
- T9：改造 `marketLiquidityV5Service.ts`
  - 删除内部 `buildYield10yPctByDate` 分散逻辑
  - 改为调用统一服务
- T10：改造 `valueTiming.ts`
  - 删除模块内年度抓取、7 日回看、旧快照 10Y 兜底
  - 统一改走 `riskfree10yService`
- T11：改造 `lowVol.ts`
  - 删除静默吞错式 10Y 拉取
  - 统一改走 `riskfree10yService`
- T12：兼容适配
  - 旧 `chinamoneyGovBond.ts` 保留短期兼容层或转发层
  - 明确后续下线点

## P0 刷新脚本与发布守卫
- T13：改造 `refreshMarketBoardPoints.ts`
  - 用统一 `probeRiskfree10y` 替代当前弱探针
  - 在发布前校验 10Y 可用性与来源一致性
- T14：改造 `refreshLowVolSnapshots.ts`
  - 增加统一 probe
  - 将 10Y 覆盖率纳入失败不发布条件
- T15：改造 `refreshValueTimingSnapshots.ts`
  - 增加统一 probe
  - 移除对旧快照 10Y 的隐式依赖

## P1 测试
- T16：provider 单元测试
  - 成功样例
  - 空数据
  - HTML 结构变化
  - 504/超时/Abort/非预期 content-type
- T17：service 聚合测试
  - S1 成功且被 S2/S3 确认
  - S1 失败但 S2/S3 一致
  - 单源成功但跳变过大被拒绝
  - 三源分歧过大被拒绝
  - 7 日回看对齐
- T18：模块回归测试
  - 大盘看板 `yield10yPct` 与股债性价比序列回归
  - 低波机会 `yield10yPct/spreadPct/spreadPctRank10y` 回归
  - 价值择时 `yield10yPct/spreadPct/spreadPctRank5y` 回归
- T19：脚本级回归测试
  - 三个刷新脚本在 10Y 源异常时均能阻止误发布
  - 保留旧 run 可见性
- T20：live smoke
  - 最近 90 个交易日实测
  - 记录三源成功率、确认方式、拒绝次数

## P1 可观测性
- T21：统一日志字段
  - provider、耗时、值、日期、选值规则、剔除原因
- T22：统一指标
  - success ratio
  - timeout ratio
  - disagreement bp
  - single-source accept count
- T23：输出回归报告
  - 最近 90 日 live smoke 汇总
  - 三模块接入前后差异说明

## 建议实施顺序
- 第 1 天：T1-T8
- 第 2 天：T9-T15
- 第 3 天：T16-T20
- 第 4 天：T21-T23，整理发布说明

## 完成定义
- 三个模块不再直接依赖旧的分散式 10Y 抓取逻辑
- `riskfree10yService` 成为唯一入口
- 自动化测试覆盖 provider、service、模块接入、刷新脚本四层
- 最近 90 个交易日 smoke 结果达标并形成可复核报告
