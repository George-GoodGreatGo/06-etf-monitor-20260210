# 大盘看板：成交额/换手率 Provider Fallback 加固 Spec

## Why
当前 GitHub Actions 在 `runner-stable` 策略下已经解决了 `HS300 close` 的单点问题，但 `SH/SZ amount+tr` 仍然只依赖 `Eastmoney`。最新报错显示：`HS300 close`、`HS300 PE`、`northbound`、`10Y` 均可用，唯独 `market_turnover` 在 probe 阶段因 `fetch failed` 触发硬失败，导致整次 backfill 直接退出。

这说明当前 `runner-stable` 仍未覆盖“成交额/换手率”这条关键链路。已完成候选源调研：`AkShare-东方财富`（`index_zh_a_hist` / `stock_zh_index_daily_em`）连续失败并报 `ProxyError`；`AkShare-新浪`（`stock_zh_index_daily`）虽然可返回日线，但只有 `date/open/high/low/close/volume`，缺少 `amount` 与 `tr`；`csindex index-perf` 对 `000001` 仅返回 `tradingValue/tradingVol` 且无 `turnover`，对 `399001` 返回空；只有 `Baostock query_history_k_data_plus(date,amount,turn)` 能稳定覆盖 `sh.000001` 与 `sz.399001` 的两项关键字段。因此本次方案应以 `Baostock` 作为 `market_turnover` 的 GitHub Runner 主链路，而不是继续假设存在多个等价可替换源。

最新 GitHub Runner 报错又暴露出第二层问题：虽然 workflow 已执行 `python -m pip install -r server/python/requirements.txt`，但 `requirements.txt` 当前并未声明 `baostock`，导致 `runner-stable` 在真正切到 `Baostock` 主链路时出现 `No module named 'baostock'`。这说明“数据源策略正确”还不够，必须把“Runner 依赖完整性”纳入同一条稳定链路的规格范围。

最新一次 GitHub Actions 日志又暴露出第三层问题：`probe`、`compute_smoke` 与首个分段都能成功，但在后续分段中 `Baostock` 偶发返回“非 JSON 内容”，触发 `market_turnover providers failed: baostock=unknown:Baostock 返回非 JSON 内容`。这说明当前链路还存在“长回灌阶段 stdout 污染或解析器过于脆弱”的问题。系统不仅要确保 `Baostock` 已安装，还必须保证 `runBaostock()` 在长时间、多分段调用时只消费稳定、可恢复的 JSON 输出，并能在出现噪音时给出可诊断信息。

## What Changes
- 将 `SH/SZ amount+tr` 从“固定走 `Eastmoney`”改造为独立的序列级 provider 链，不再与 `HS300 close` 共用同一稳定性假设。
- 将 GitHub Runner 上的 `market_turnover` 主链路明确为 `Baostock`；`Eastmoney` 保留为非 Runner 或补充场景使用，不再作为 GitHub Runner 唯一依赖。
- 不将 `AkShare-新浪` 与 `csindex` 视为 `market_turnover` 的等价 fallback：前者缺少 `amount/tr`，后者无法稳定覆盖 `000001 + 399001` 且缺少 `turnover`。
- 将 Python 运行依赖纳入稳定链路定义：凡 `runner-stable` 依赖的 Python provider，必须在 `server/python/requirements.txt` 和 GitHub workflow 安装步骤中得到显式保障。
- 将 `Baostock` stdout 纯净性与 JSON 解析韧性纳入稳定链路定义：长回灌、多分段调用时，stdout 中即便夹杂噪音，也应尽量提取 JSON 主体，或至少输出可定位的原始片段摘要。
- 调整 backfill probe：对 `market_turnover` 输出 provider 顺序、命中的 provider、失败原因与字段覆盖率，不再只返回笼统的 `fetch failed`。
- 调整 fail-fast 规则：仅当 `SH/SZ amount+tr` 的全部候选 provider 都失败，或覆盖率不足以安全构建流动性序列时，才终止 backfill。
- 保持实现简单：不新增数据库表、不改前端接口；只增强 provider 解析、日志与回灌预检。

## Impact
- Affected specs:
  - `harden-market-board-github-runner-failover`
  - `stabilize-market-board-github-data-sources`
  - `enforce-market-board-nightly-full-backfill`
- Affected code:
  - `server/lib/marketLiquidityV5Service.ts`
  - `server/scripts/refreshMarketBoardPoints.ts`
  - `server/lib/akshare.ts`
  - `server/lib/baostock.ts`
  - `server/python/akshare_service.py`
  - `server/python/baostock_service.py`
  - `server/python/requirements.txt`
  - `.github/workflows/refresh-market-board.yml`

## ADDED Requirements
### Requirement: SH/SZ amount+tr 必须具备独立 provider 链
系统 SHALL 为 `上证/深证` 的 `amount` 与 `tr` 提供独立的 provider 解析链，而不是只依赖 `Eastmoney` 单一入口。

#### Scenario: Eastmoney 在 GitHub Runner 上失败
- **GIVEN** workflow 运行在 GitHub Runner
- **AND** `Eastmoney` 获取 `SH/SZ amount+tr` 时出现 `fetch failed`
- **WHEN** 系统需要构建流动性序列
- **THEN** 系统优先使用 `Baostock` 获取 `sh.000001` 与 `sz.399001` 的 `amount` 和 `turn`
- **AND** 仅当全部 provider 都失败时，才将 `market_turnover` 判定为不可用

### Requirement: market_turnover 的 GitHub Runner 主链路必须以实测字段完整性为准
系统 SHALL 根据已验证结果，为 `market_turnover` 在 GitHub Runner 上使用 `Baostock` 作为主链路，而不是继续把 `AkShare-东方财富`、`AkShare-新浪` 或 `csindex` 当作等价候选。

#### Scenario: schedule 任务构建流动性序列
- **GIVEN** workflow 由 `schedule` 触发
- **WHEN** 系统需要获取 `SH/SZ amount+tr`
- **THEN** 系统优先使用 `Baostock query_history_k_data_plus(date,amount,turn)`
- **AND** 不将 `AkShare-新浪` 用作 `market_turnover` 回退，因为其缺少 `amount` 与 `tr`
- **AND** 不将 `csindex` 用作 `market_turnover` 主链路，因为其字段和指数覆盖不足

### Requirement: runner-stable 依赖的 Python 模块必须在 GitHub Runner 上显式可安装
系统 SHALL 对 `runner-stable` 所依赖的 Python provider 维持可复现安装；如果策略会使用 `Baostock`，则 `baostock` 必须被显式声明在 Python 依赖清单中，并在 workflow 中被安装验证。

#### Scenario: GitHub Actions 安装 Python 依赖
- **GIVEN** workflow 将执行 `runner-stable`
- **WHEN** GitHub Runner 安装 `server/python/requirements.txt`
- **THEN** `baostock` 已包含在依赖清单中
- **AND** 后续脚本调用 `runBaostock()` 时不会因 `No module named 'baostock'` 失败

### Requirement: probe 失败信息必须区分“源失败”和“环境缺依赖”
系统 SHALL 在 `market_turnover` 的 probe 里区分“provider 本身不可用”和“Runner 缺少依赖模块”两类失败，以便快速定位到数据源问题还是部署问题。

#### Scenario: Baostock 模块未安装
- **GIVEN** `Baostock` 未安装在 GitHub Runner
- **WHEN** probe 尝试 `market_turnover` 的 `Baostock` provider
- **THEN** 日志明确指出这是 `python dependency missing`
- **AND** 如果后续 provider 可用，则继续回退；否则按硬失败处理

### Requirement: Baostock 在长回灌过程中必须输出可稳定解析的 JSON
系统 SHALL 保证 `Baostock` 在 backfill 多分段、重复调用场景下输出可稳定解析的 JSON；若 stdout 中夹杂噪音，解析层应优先尝试提取 JSON 主体，而不是直接把整次 provider 调用判定为 `unknown`。

#### Scenario: probe 通过但后续分段出现 stdout 噪音
- **GIVEN** `probe`、`compute_smoke` 与前序分段已成功
- **AND** 后续某一分段调用 `runBaostock()` 时 stdout 出现非 JSON 前后缀或杂讯
- **WHEN** 系统解析 `Baostock` 返回内容
- **THEN** 系统优先尝试提取有效 JSON 主体
- **AND** 若仍失败，日志输出原始 stdout 摘要、命令上下文与分段区间
- **AND** 错误分类不应仅表现为笼统的 `unknown`

### Requirement: market_turnover 的稳定性验证必须覆盖多分段 backfill 场景
系统 SHALL 不仅验证 `probe` 与单次 `compute_smoke`，还要验证 `market_turnover` 在多分段 backfill 连续调用中不会因 stdout 污染而失败。

#### Scenario: 从 2016 起执行多分段 backfill
- **GIVEN** backfill 会按多个时间段连续调用 `market_turnover` provider
- **WHEN** 系统完成稳定性验证
- **THEN** 验证范围覆盖至少“probe 成功 + 首段成功 + 后续分段继续成功”的连续调用场景
- **AND** 不能只以 probe 成功作为链路稳定的结论

### Requirement: market_turnover probe 必须输出可操作的诊断信息
系统 SHALL 在预检阶段对 `market_turnover` 输出结构化日志，能直接说明“失败在哪个 provider、哪个字段、为什么失败”。

#### Scenario: market_turnover 预检失败
- **GIVEN** `market_turnover` 无法通过首选 provider 获取
- **WHEN** 系统输出 probe 日志
- **THEN** 日志包含 provider 顺序、各 provider 的摘要错误、命中的字段覆盖率
- **AND** 错误不应仅表现为笼统的 `fetch failed`

### Requirement: market_turnover 的 fail-fast 以“全链路失败或覆盖率不足”为准
系统 SHALL 仅在 `market_turnover` 的所有候选 provider 都失败，或返回数据无法满足最小覆盖要求时，才终止 backfill。

#### Scenario: 首选 provider 失败但后续 provider 可用
- **GIVEN** 首选 provider 失败
- **AND** 后续 provider 能返回足够的 `amount` 与 `tr`
- **WHEN** 系统执行 backfill
- **THEN** backfill 继续执行
- **AND** `meta.notes` 与日志记录真实命中的 provider 和降级原因

### Requirement: GitHub Runner 的稳定策略必须同时覆盖 HS300 close 与 market_turnover
系统 SHALL 使 `runner-stable` 不仅稳定解决 `HS300 close`，也稳定覆盖 `market_turnover`。

#### Scenario: schedule 任务启动
- **GIVEN** workflow 由 `schedule` 触发
- **WHEN** 未显式指定数据源策略
- **THEN** 系统使用 GitHub Runner 稳定策略
- **AND** `HS300 close` 使用既有稳定链路
- **AND** `market_turnover` 默认使用 `Baostock`

## MODIFIED Requirements
### Requirement: GitHub Actions 默认稳定策略
系统 SHALL 不再把 `runner-stable` 仅视为“HS300 close 稳定化”策略；它必须同时覆盖大盘看板构建所需的全部关键序列，特别是 `SH/SZ amount+tr`，且 `market_turnover` 默认采用 `Baostock` 主链路。

### Requirement: 回灌预检的硬失败边界
系统 SHALL 对 `market_turnover` 使用“多 provider 尝试 + 覆盖率判定”的硬失败标准，而不是在首个 `Eastmoney` 请求失败时立即终止整次 backfill。

### Requirement: GitHub Runner 依赖安装一致性
系统 SHALL 保证 workflow 的“Install Python deps”步骤与运行时实际依赖集合一致；新增或切换 Python provider 时，必须同步更新 `requirements.txt` 与相应验证步骤。

### Requirement: Baostock 解析失败日志必须可诊断
系统 SHALL 在 `Baostock` 解析失败时保留足够的诊断信息，例如 stdout 前后片段、调用命令、缓存键或分段区间，以便快速判断是库自身噪音、编码问题还是缓存污染。

## REMOVED Requirements
N/A
