# 低波机会：定时队列拉取快照 + WAF 熔断（减少封禁） Spec

## Why
低波机会依赖 csindex/cnindex 等上游数据源。当 csindex 被 WAF 拦截（HTTP 403）时，用户侧会直接失败并进入错误态。同时，用户访问触发的实时并发拉取会放大请求频率，更容易触发限流/封禁。需要从机制上把“高频实时拉取”变成“低频、可控、队列化的定时拉取”，并以 Supabase 快照作为用户访问时的默认数据来源，最大化降低封禁概率；同时保持“不展示任何推测值”。

## What Changes
- 新增“低波指数快照”存储：按 `code + dataDate` 存储每日快照至 Supabase（上游成功后写入）。
- 新增定时刷新机制（北京时间 20:00–22:00 窗口内执行）：
  - 以队列方式依次拉取支持指数的最新数据并写入 Supabase
  - 对单指数失败采用有限重试（带退避与抖动）；对 WAF 拦截触发熔断并提前终止本轮任务（避免越拉越封）
- 改造服务端读取链路：用户访问时默认优先读取 Supabase 的最新快照，不直接请求 csindex（降低线上访问触发封禁的概率）。
- 保留可控的“强制回源刷新”能力（仅管理员/内部使用），并受严格限流/熔断保护。
- API 响应 `meta` 明确声明来源与时间（快照/回源、快照时间、数据交易日），前端展示“快照数据/快照时间/是否过期”，不展示推测值。

## Impact
- Affected specs: 低波机会数据拉取策略、错误态展示策略
- Affected code:
  - `server/lib/lowVol.ts`：WAF 识别、熔断、限流、快照优先读取、定时刷新入口
  - `server/routes/lowVol.ts`：在 `/index/:code` 与 `/summary` 输出快照 meta；提供可控强制刷新参数（可选）
  - `server/lib/supabaseRest.ts`：新增低波快照读写封装
  - 调度：GitHub Actions 或服务端定时任务（选择现有最合适机制）
  - `src/components/LowVolOpportunityPanel.tsx` 与 `Home`：展示“快照数据/快照时间/是否过期”提示（最小改动）

## ADDED Requirements
### Requirement: 低波指数每日快照存储
系统 SHALL 按 `code + dataDate` 维度存储低波指数的每日快照到 Supabase，并可读取最新快照。

#### Scenario: 写入快照
- **WHEN** 定时刷新任务成功拉取并计算某指数数据
- **THEN** 系统写入/更新该 `code + dataDate` 的快照记录（包含 payload 与 meta：`dataDate`、`snapshotAt`、`source`）

#### Scenario: 默认读取快照
- **GIVEN** Supabase 中存在该 `code` 的最新快照
- **WHEN** 用户请求低波数据
- **THEN** 系统返回快照 payload
- **AND** 在 `meta` 标注 `sourceType=snapshot` 与 `snapshotAt`

### Requirement: 定时队列刷新（北京时间 20:00–22:00）
系统 SHALL 在北京时间 20:00–22:00 的窗口内，以队列方式刷新低波支持指数的最新快照并写入 Supabase。

#### Scenario: 正常执行
- **WHEN** 到达定时刷新窗口且任务被触发
- **THEN** 系统按队列依次刷新各指数（限制并发）
- **AND** 单指数失败不影响其他指数继续刷新（除非触发 WAF 熔断）

#### Scenario: 有限重试
- **WHEN** 某指数刷新失败（非 WAF）
- **THEN** 系统最多重试 1 次（退避 + 抖动）

### Requirement: WAF 熔断（csindex）
系统 SHALL 在定时刷新或强制回源时，检测到 csindex WAF 拦截后启动熔断，冷却期内不再请求 csindex。

#### Scenario: 触发熔断
- **WHEN** csindex 请求失败且错误被识别为 WAF 拦截（403 + 拦截页特征）
- **THEN** 系统进入冷却期（默认 10–30 分钟，取固定值即可）
- **AND** 冷却期内对 csindex 的请求直接跳过（不发起网络请求）

#### Scenario: 冷却期行为
- **GIVEN** 熔断冷却期尚未结束
- **WHEN** 请求低波数据
- **THEN** 系统优先返回快照（若存在）
- **ELSE** 返回失败响应，并提供可读 message（包含“熔断/剩余时间/建议稍后重试”）

### Requirement: 请求限流与去重
系统 SHALL 对 csindex 拉取进行限流与并发去重，以降低触发封禁概率（适用于定时刷新与强制回源）。
- 并发上限：同一时刻 csindex 请求不超过 1（或 2）
- in-flight 去重：同一 `code+range` 的请求复用同一计算任务
- 重试策略：WAF 不重试；超时/5xx 最多 1 次退避重试（带随机抖动）

### Requirement: 用户访问不回源（默认）
系统 SHALL 在用户访问低波数据时默认不回源请求 csindex，而是优先使用 Supabase 快照。

#### Scenario: 快照缺失
- **GIVEN** Supabase 中无该 `code` 的快照
- **WHEN** 用户请求低波数据
- **THEN** 系统返回明确错误（提示“暂无快照/等待晚间刷新/可稍后重试”）
- **AND** 不展示推测值

## MODIFIED Requirements
### Requirement: 低波 API 的 meta 标注
系统 SHALL 在 `GET /api/lowvol/index/:code`（及 summary items）返回的 `meta` 增加如下字段：
- `sourceType`: `realtime` | `snapshot`
- `snapshotAt`: string | null
- `stale`: boolean
- `cooldownUntil`: string | null（可选）

## REMOVED Requirements
无
