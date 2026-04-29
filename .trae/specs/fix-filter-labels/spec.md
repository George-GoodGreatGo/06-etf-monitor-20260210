# 筛选区标签修正 Spec

## Why
两个细节问题：(1) 筛选区的字段标题（策略/信号/新鲜度/Z值）在极端窄屏或字体放大场景下可能换行，破坏对齐感；(2) 策略选项当前使用 `shortLabel`（如"确认卖出+12%风控"），与其他模块显示不一致，应使用 `label`（"Baseline策略"、"基础颜色切换"）。

## What Changes
- 筛选区 label `<span>` 添加 `whitespace-nowrap`，确保标题不换行
- `Home.tsx` 中 `TOP200_STRATEGY_OPTIONS` 的 label 从 `strategy.shortLabel` 改为 `strategy.label`
- `DevTop200MomentumSignalsMock.tsx` 中同步修改

## Impact
- Affected code:
  - `src/components/Top100FilterBar.tsx` — 2 处 label span 加 `whitespace-nowrap`
  - `src/pages/Home.tsx` — strategy label 改用 `strategy.label`
  - `src/pages/DevTop200MomentumSignalsMock.tsx` — 同上

## MODIFIED Requirements

### Requirement: 筛选区标签不换行 + 策略名统一
系统 SHALL 确保筛选区字段标题始终单行，策略选项名与 momentumStrategies 定义的 `label` 一致。

#### Scenario: 标签不换行
- **WHEN** 筛选区渲染
- **THEN** `策略`、`信号`、`新鲜度`、`Z值` 四个标题始终不换行

#### Scenario: 策略名统一
- **WHEN** 策略选项渲染
- **THEN** 显示 `Baseline策略` 和 `基础颜色切换`
