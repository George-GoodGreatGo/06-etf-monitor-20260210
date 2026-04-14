# 价值择时 PE 序列质量修复 Spec

## Why
当前价值择时的 PE 数据存在两类质量问题：
- 980081（国证价值100）采用 ETF 代理口径时，Eastmoney `qt/stock/get` 返回的 `f162` 为 0，导致 `earningsYieldPct=100/PE` 为空，进而利差/分位失真。
- 932315/932365 通过中证 indicator xls 解析 PE 时，仅解析出极少行（如 points=20），导致 PE 历史序列严重缺失，价值择时输出不可信。

## What Changes
- 修复 CSIndex indicator xls 的解析：支持 Excel 日期序列号、动态识别表头与列位置，确保产出完整历史 PE 序列。
- 修复 980081 的推算口径 PE：定位 Eastmoney 字段不适用原因，改用可验证的估值来源/字段映射，确保 PE 不再为 0 或被错误当成有效值。
- 统一 PE 有效性规则：`pe<=0` 一律视为缺失（`pe=null`），并在快照 `notes` 中记录原因与数据源信息。
- 增加回归验证：单测覆盖“Excel 数字日期解析”“PE 序列长度与覆盖率”“980081 不再使用 pe=0”。

## Impact
- Affected specs: 价值择时数据可信度、推算口径可追溯性
- Affected code:
  - `server/lib/csindexIndexValuation.ts`
  - `server/lib/valueTiming.ts`
  - `server/scripts/refreshValueTimingSnapshots.ts`（notes 与日志）

## ADDED Requirements
### Requirement: CSIndex indicator PE 序列完整性
系统 SHALL 从中证 indicator 文件中解析出覆盖多年历史的 PE 时间序列（非零星行数）。

#### Scenario: Excel 日期为数字
- **WHEN** indicator xls 中日期列为 Excel 序列号（number）
- **THEN** 系统将其正确转换为 `YYYY-MM-DD` 并写入输出序列

#### Scenario: 932315/932365 序列长度
- **WHEN** 系统拉取 932315 或 932365 的 indicator 数据
- **THEN** 输出序列的有效行数 SHOULD 大幅高于 20（目标：与指数收盘点位数量同量级）

### Requirement: 980081 PE 不得为 0 的“假有效值”
系统 SHALL 将 `pe<=0` 视为缺失，不得作为有效 PE 参与计算。

#### Scenario: Eastmoney 字段不适用
- **WHEN** Eastmoney 返回 `pe=0`（或缺失）
- **THEN** 系统将其记录为 `pe_missing`，并切换到备用估值来源（同一次运行或后续运行）
- **AND** 快照 `notes` 中包含估值来源与失败摘要，便于追溯

### Requirement: PE 来源可追溯
系统 SHALL 在快照数据中记录 PE 来源信息：
- `source_type/source/notes` 包含：使用的 provider、字段/端点、以及降级原因（若发生）。

## MODIFIED Requirements
### Requirement: 980081 PE 数据源（推算口径）
980081 的 PE 推算 SHALL 使用“可验证的估值来源”，不得依赖对 ETF 品种无意义的字段（如 `qt/stock/get` 的 `f162=0`）。

