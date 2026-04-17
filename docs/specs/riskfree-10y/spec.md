# 中国10年期国债收益率统一多源改造规格

## 背景
- 当前三条业务链路都依赖单源 10Y 抓取能力，但实现分散、容错不一致：
  - `server/lib/chinamoneyGovBond.ts` 负责按年抓取并解析 10Y 数据，模块名是 `chinamoney`，实际抓取的是 `yield.chinabond.com.cn` 年度 xlsx。
  - `server/lib/marketLiquidityV5Service.ts` 在大盘看板内单独拼装 `yield10yPctByDate`。
  - `server/lib/valueTiming.ts` 有自己的年度抓取、7 日回看和上次快照兜底逻辑。
  - `server/lib/lowVol.ts` 也有独立抓取逻辑，但失败时大多静默吞掉。
- 现状问题不是只有“源站偶发超时”，而是“单源脆弱 + 多处重复 + 失败语义不一致”：
  - 某些模块失败后直接缺值。
  - 某些模块会回退旧快照。
  - 某些脚本仅做弱探测，不足以保证 run 发布前数据真实可用。

## 目标
- 以“真实、稳定、简单、可复用”为原则，统一建设 `riskfree10yService`，供大盘看板、低波机会、价值择时共享。
- 使用 3 个公开、免费、可审计的数据源组成多源体系，优先官方/半官方来源，避免依赖收费 API 或高度脆弱的页面抓取。
- 在不改变三个模块业务口径的前提下，收敛重复逻辑，统一失败处理、日志和测试。
- 严格执行“失败不伪造、不拿昨日值冒充今日值、不因单源抖动导致误发布”。

## 非目标
- 不修改前端展示、文案、图形交互。
- 不改变大盘看板、低波机会、价值择时已有指标公式。
- 不引入复杂的统计融合模型，不为了“看起来高级”增加难维护机制。

## 设计原则
- 简单优先：使用确定性规则，不使用加权中位数、动态打分、可变权重等复杂机制。
- 官方优先：优先采用官方或准官方口径做最终确认，财经站点公开数据用于交叉校验和容错。
- 真实性优先：当日值不可确认时，宁可失败不发布，也不伪造“成功”。
- 复用优先：抓取、标准化、日期对齐、短窗回看、缓存、日志都下沉到统一服务。
- 行为一致：三个模块对 10Y 的取值、缺失、回退语义保持一致。

## 范围
- 新增统一服务：`server/lib/riskfree10yService.ts`
- 新增数据源提供器目录：`server/lib/riskfree10yProviders/`
- 三模块接入改造：
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/lib/valueTiming.ts`
  - `server/lib/lowVol.ts`
- 刷新脚本与探针改造：
  - `server/scripts/refreshMarketBoardPoints.ts`
  - `server/scripts/refreshLowVolSnapshots.ts`
  - `server/scripts/refreshValueTimingSnapshots.ts`
- 现有 `server/lib/chinamoneyGovBond.ts` 迁移为 provider 之一，保留兼容期后下线或仅作适配层。

## 数据源方案
### 核心三源
- S1：`chinamoney`，中国货币网公开“10年期国债收益率/收盘收益率曲线”页面或公开查询接口。
  - 定位：官方优先源，偏“当日/近端确认”。
  - 优点：官方口径清晰，真实性强。
  - 风险：页面结构或访问策略可能调整。
  - 首版实现注记：Node 环境下历史 JSON 接口实测易返回 403，首版仅稳定接入其最新 JSON 作为“最新值确认源”，不承担长历史拉取。
- S2：`chinabond`，中债收益率曲线公开页面/下载接口。
  - 定位：官方历史序列主力源，优先承接历史区间和按年回补。
  - 优点：现有代码已验证，历史覆盖长。
  - 风险：年度文件下载大、超时偏多。
- S3：`eastmoney`，东方财富公开行情/数据中心可解析端点。
  - 定位：公开财经校验源与容错源。
  - 优点：访问成功率通常较高，适合作为第三方校验。
  - 风险：字段或端点可能调整，需做轻量适配。

### 取舍说明
- 本次规格不引入收费或需密钥的数据源作为核心链路。
- 本次规格不把 `TradingEconomics`、`Investing` 这类额外来源纳入首版交付，以避免配置复杂度和维护面扩大。
- 已有 `Baostock` 不作为核心 10Y 真值来源，仅允许作为后续观测性补充，不参与首版最终取值判定。

## 统一服务设计
### Provider 接口
- 每个 provider 实现统一接口：
  - `fetchRange({ startDate, endDate })`
  - 返回 `Map<string, Riskfree10yPoint>`
- 标准字段：
  - `date`: `YYYY-MM-DD`
  - `valuePct`: 百分比口径，例如 `1.83`
  - `source`: 固定源名
  - `observedAt`: 抓取时间
  - `sourceDetail`: 端点、模式、解析版本等简要说明

### Service 接口
- `getRiskfree10ySeries({ startDate, endDate, forceRefresh? })`
  - 返回标准化后的日序列和元信息
- `getRiskfree10yValueByDate({ date, lookbackDays? })`
  - 用于三模块按交易日取值，默认统一回看 `7` 天
- `probeRiskfree10y({ date? })`
  - 用于刷新脚本在发布前做集中探针

### 统一下沉能力
- 多源并发抓取
- 统一超时/重试/限速
- 单位和日期标准化
- 统一的 `lookbackDays=7` 日期对齐
- 日级缓存与 in-flight 去重
- 结构化 notes 和 probe 明细

## 取值与一致性规则
### 基础过滤
- 过滤空值、非数值、负值、超过 `10%` 的异常值。
- 同一来源同一天多值时，仅保留解析链路最稳定的一条。

### 最终选值规则
- 规则 1：若 S1 有效，且 S2/S3 中至少一个与 S1 的差值不超过 `20bp`，则采用 S1。
- 规则 2：若 S1 失效，但 S2 与 S3 都有效且差值不超过 `20bp`，则采用二者均值。
- 规则 3：若仅 1 个来源有效，则必须同时满足以下条件才允许采用：
  - 数值在合理范围内；
  - 与最近一个已发布交易日值的跳变不超过 `50bp`；
  - provider 自身未标记解析异常或降级异常。
- 规则 4：若以上条件都不满足，则视为当日不可确认，失败不发布。

### 说明
- 这里采用“优先源确认 + 双源交叉 + 单源严格兜底”的确定性规则。
- 不引入中位数聚合、复杂投票或黑盒评分，便于排查和长期维护。

## 历史区间与日期对齐
- 历史区间抓取优先顺序：
  - `chinabond` 承担长历史区间拉取
  - `chinamoney` 承担最新值/近端确认
  - `eastmoney` 承担交叉校验和缺口补点
- 对业务模块暴露统一日期对齐能力：
  - 先取同日；
  - 同日无值时回看最近 `7` 个自然日；
  - 超过 `7` 天仍无值则返回空值，不前向伪填充。
- 禁止各模块继续各自实现 7 日回看、快照兜底或 silent swallow。

## 失败处理与发布策略
- 服务层失败：
  - 若指定日期无法确认真值，返回明确错误码和失败明细。
- 模块计算层失败：
  - 大盘看板、低波机会、价值择时统一依赖服务结果，不再各自做不同语义的 10Y 兜底。
- 发布层失败：
  - 夜间 run 刷新时，只要 10Y 关键覆盖率或真值校验不达标，则整批不发布。
  - 保留当前可见 run，不用旧值冒充新 run。
- 探针策略：
  - `refreshMarketBoardPoints.ts` 的 probe 改为调用统一 `probeRiskfree10y`。
  - 低波与价值择时刷新脚本也在发布前执行同样探针。

## 缓存与性能
- 服务内部提供日级缓存：
  - 默认 TTL `24h`
  - `forceRefresh=true` 时禁止命中 stale cache
- 历史区间缓存按年份或月份切片，避免每次全量重复下载大文件。
- 保留 in-flight 去重，避免多个模块同时刷新时重复抓取同一来源。
- 对外仅暴露统一服务，不让模块直接碰各 provider，减少重复 I/O。

## 可观测性
- 每次服务调用记录：
  - 参与源
  - 每源耗时
  - 每源结果日期和值
  - 是否触发回退
  - 最终采用规则
  - 被剔除原因
- 建议输出指标：
  - `riskfree10y_fetch_success_ratio`
  - `riskfree10y_source_timeout_ratio`
  - `riskfree10y_source_disagreement_bp`
  - `riskfree10y_single_source_accept_count`
  - `riskfree10y_probe_fail_count`

## 回归测试要求
### 单元测试
- 每个 provider 的解析成功样例。
- HTML 结构变化、空表、返回 504、返回非表格内容。
- 超时、Abort、重试次数与错误透传。
- 单日值标准化和异常值过滤。

### 服务层测试
- 三源都成功且 S1 被确认。
- S1 失败，S2/S3 一致时成功。
- 单源成功但跳变过大时拒绝。
- 三源分歧过大时拒绝。
- `lookbackDays=7` 对齐行为一致。
- `forceRefresh=true` 时不命中 stale cache。

### 模块回归测试
- 大盘看板：
  - 股债性价比序列长度、末端日期、`yield10yPct` 覆盖率与现有行为一致或更稳。
- 低波机会：
  - `yield10yPct`、`spreadPct`、`spreadPctRank10y` 覆盖率满足发布阈值。
- 价值择时：
  - `yield10yPct`、`spreadPct`、`spreadPctRank5y` 覆盖率满足发布阈值。
  - 删除旧快照兜底后，失败语义仍符合“失败不发布”。

### 端到端验证
- 对最近 `90` 个交易日跑 live smoke，统计：
  - 成功率
  - 每源成功率
  - 单源接受次数
  - 双源确认次数
  - 拒绝发布次数
- 对三条夜间刷新脚本分别做一次全链路 dry-run 或 staging 验证。

## 验收标准
- 三个模块全部改为只通过 `riskfree10yService` 取 10Y 数据。
- 删除模块内部重复的 10Y 抓取、7 日回看和不一致兜底逻辑。
- 最近 `90` 个交易日 live smoke 成功率达到 `>=99%`。
- 发布脚本在单源波动场景下能稳定切换，不产生假成功 run。
- 测试覆盖 provider、service、模块接入和脚本探针四层。

## 迁移计划
- 第 1 步：新增 `riskfree10yService` 与 3 个 provider，不改业务。
- 第 2 步：先接入大盘看板，再接入低波机会、价值择时。
- 第 3 步：统一刷新脚本 probe 和发布前校验。
- 第 4 步：补齐 live smoke 与回归测试。
- 第 5 步：下线旧的直连 10Y 逻辑，仅保留短期兼容适配层。
