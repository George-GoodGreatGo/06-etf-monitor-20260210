# 计划：修复 RPS 基准 512890 抓取失败（GitHub Actions）

## 1. Summary
- 修复 `refreshRpsStyleSnapshots` 在 GitHub Actions 中反复报错 `无法获取前复权日线: 512890` 的问题。
- 核心方向：保持基准仍为 `512890.SH`，增强抓取链路稳健性（多源兜底 + 可观测日志），避免因单一外部接口波动导致持续不发布。
- 目标：在不改变策略口径的前提下，提高 nightly 刷新发布成功率。

## 2. Current State Analysis
- 当前 `server/lib/rpsStyle.ts`：
  - 主源：`fetchEastmoneyDailyKline`（JS）
  - 兜底：`runAkshare -> rps-qfq`（Python）
  - 失败路径会触发容灾回退，workflow 结果为成功但 `published=false`。
- 当前 `server/python/akshare_service.py:rps_qfq`：
  - 实际仅调用 `_hist_daily_custom(..., fqt=1)`（Eastmoney push2his）
  - 若返回空，直接报 `无法获取前复权日线`，缺少 ETF 专用第二数据源。
- 当前问题表现：
  - 本地可偶发成功，GitHub 上多次失败，符合“单源接口在特定运行环境不稳定”的特征。
  - 错误信息粒度不够，无法区分是主源空数据、超时、还是兜底源内部失败。

## 3. Proposed Changes

### 3.1 Python 抓取链路：增加 ETF 专用二级兜底
- 修改文件：`server/python/akshare_service.py`
- 在 `rps_qfq` 中新增多级抓取顺序（保持前复权口径优先）：
  1. `_hist_daily_custom(code, st, ed, 1)`（现有）
  2. `ak.fund_etf_hist_em(symbol=code, period="daily", start_date=st, end_date=ed, adjust="qfq")`
  3. 可选保底：`ak.fund_etf_hist_sina(symbol=sh/sz + code)`（若口径不完全一致，作为最后兜底并在 notes 标注）
- 每级都统一归一化到 `date/close`，并严格过滤非法值。
- 返回 `meta.notes` 增加 `source_path`（如 `custom_eastmoney -> fund_etf_hist_em`），便于排障。

### 3.2 Node 层错误可观测性增强
- 修改文件：`server/lib/rpsStyle.ts`
- `fetchQfqDailyWithFallback` 改为保留错误上下文：
  - 记录主源错误（Eastmoney JS）与兜底错误（AkShare Python）消息
  - 失败时抛出带双源上下文的错误，例如：
    - `qfq failed 512890.SH | eastmoney: ... | akshare: ...`
- 对基准 ticker 抓取可额外增加一次重试轮次（仅 benchmark 使用），降低单点波动影响。

### 3.3 刷新日志增强（发布脚本）
- 修改文件：`server/scripts/refreshRpsStyleSnapshots.ts`
- 失败时将完整错误原因写入 `qualitySummary.error`（现已写入，保留并补充结构化字段）。
- 成功时在 `qualitySummary` 记录 `benchmarkSource` 与各 ticker `source`，便于确认是否命中兜底。

### 3.4 工作流稳定性（可选增强）
- 修改文件：`.github/workflows/refresh-rps-style-snapshots.yml`（可选）
- 增加 AkShare 相关环境参数（不改业务逻辑）：
  - `AKSHARE_RETRIES`
  - `AKSHARE_RETRY_SLEEP_SEC`
- 让 Python 层接口抖动时有更平滑退避。

## 4. Assumptions & Decisions
- 不回退策略基准到 `515080`，继续使用 `512890.SH`。
- 优先保证“前复权口径”，若进入最后保底源需在 notes 明确标注来源，确保可审计。
- 保持现有容灾回退机制不变（失败不发布、沿用旧 run），本次是提高成功发布概率。

## 5. Verification Steps
- 本地验证：
  - 单独执行：
    - `python server/python/akshare_service.py rps-qfq --ticker 512890 --start-date 20160101 --end-date <today>`
  - 确认返回 `success=true` 且 `series` 非空，`meta.notes` 包含来源路径。
- 集成验证：
  - 执行：
    - `npx tsx server/scripts/refreshRpsStyleSnapshots.ts`
  - 预期：
    - 不再因 `512890` 抓取失败而持续 `published=false`（除非全源均失败）
    - 成功时输出 `published=true`，并带 source 信息。
- 工作流验证：
  - 手动触发 GitHub Action 一次，核对日志中 source path 与 run 发布状态。
- 工程验证：
  - `npm run build` 通过。
  - `GetDiagnostics` 检查 `rpsStyle.ts`、`akshare_service.py`、`refreshRpsStyleSnapshots.ts` 无新增错误。
