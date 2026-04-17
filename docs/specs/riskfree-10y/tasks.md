# 任务拆解（CN10Y多源稳健获取）

## 模块与工单
- riskfree10yService（后端新模块）
  - T1：创建Provider接口定义（fetch(date): Result）
  - T2：实现S1-Chinamoney提供器（解析、重试、时间预算、指纹）
  - T3：实现S2-Eastmoney提供器（直接或经AkShare包装；限速与UA策略）
  - T4：实现S3-Sina与S3b-TE/Investing提供器（可选开关，满足≥3源）
  - T5：聚合器：并发抓取、过滤、加权中位数、30bp阈值离群剔除
  - T6：服务层缓存（24h）、calcVersion快照隔离与日志notes输出
  - T7：REST接口 /riskfree/10y 与 SDK 封装
  - T8：指标埋点与告警（成功率、偏差、超时、回退触发）
- 三模块接入改造
  - T9：大盘看板改为调用riskfree10yService（保持现有run发布链路）
  - T10：低波机会改造读取层
  - T11：价值择时改造读取层
  - T12：保留旧直连抓取为紧急兜底开关（默认关闭）
- 测试与发布
  - T13：单元测试：解析器/异常/结构变更/时间预算与重试
  - T14：集成测试：多源并发、离群剔除、中位数一致性
  - T15：端到端：T+1夜间任务跑近90个交易日验证；原子发布回归
  - T16：CI校验与回归报告输出；阈值告警联调

## 设计与实现要点
- Provider接口
  - 输入：日期（默认最近交易日）；输出：{ value, source, observedAt, raw?, notes? }
  - 需内置：connect/read超时、重试次数、幂等策略、UA/Referer与限速
- 聚合器
  - 同步并发抓取（受控并发数≤3）；先快返回，后续源用于校验
  - 过滤规则与30bp偏差阈值；仅剩单源时需通过“可信值判定”
  - 最终选择与notes记录（参与源、偏差分布、剔除原因）
- 发布链路
  - point落表→整批校验→meta原子切换可见run→保留最近5个run
  - 失败保持旧run；不进行“以昨日值回填今日”的非真实发布

## 配置项（示例）
- riskfree10y.enabledSources: ["chinamoney","eastmoney","sina","te","investing"]
- riskfree10y.timeoutMs: { connect: 1500, read: 1500 }
- riskfree10y.retry: { max: 2, backoffMs: 300 }
- riskfree10y.deviationBp: 30
- riskfree10y.cacheTTL: "24h"
- riskfree10y.calcVersion: "cn10y-v1"
- te.apiKey?: "..."

## 交付物
- 代码与接口：riskfree10yService模块、REST与SDK、三模块接入改造
- 文档：数据源解析说明、异常与回退策略、告警阈值说明
- 测试：单元/集成/E2E报告与覆盖率
- 运维：仪表盘与告警规则

