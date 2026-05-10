# 策略排序与默认策略调整 Spec

## Why
当前「Baseline加强风控」V6.1 的 ATR-3x 止损在线上触发过于敏感（根因已修复），且该策略作为默认策略的实验效果未达预期。用户决策将「Baseline策略」（confirmTrail12）恢复为默认策略，并按以下顺序排列：Baseline策略 → Baseline加强风控 → 基础颜色切换。

## What Changes
- `DEFAULT_MOMENTUM_STRATEGY_ID` 从 `'baselineEnhanced'` 恢复为 `'confirmTrail12'`
- `MOMENTUM_STRATEGIES` 数组重新排序：confirmTrail12 首位，baselineEnhanced 第二位，baseColorFlip 第三位
- confirmTrail12 的 `roleLabel` 恢复为 `'默认策略'`
- baselineEnhanced 的 `roleLabel` 改为 `''`（去除默认标签）
- 动量分析页面、ETF200列表页面、分析方法页面均通过策略注册表自动生效

## Impact
- Affected specs: `add-baseline-enhanced-risk-strategy`
- Affected code: `src/utils/momentumStrategies.ts` — 仅一行数组重排 + 两处标签/默认值切换

## MODIFIED Requirements

### Requirement: 默认策略恢复为 confirmTrail12
**Reason**: V6.1 ATR 行为与回测不一致，在行为修复完成前恢复稳定策略为默认
**Migration**: `DEFAULT_MOMENTUM_STRATEGY_ID` 改为 `'confirmTrail12'`；`confirmTrail12` 的 roleLabel 恢复为 `'默认策略'`；`baselineEnhanced` 的 roleLabel 去除默认标签

### Requirement: 策略列表排序
系统 SHALL 按以下顺序展示策略选项：Baseline策略（默认）→ Baseline加强风控 → 基础颜色切换。
**Migration**: `MOMENTUM_STRATEGIES` 数组元素按上述顺序排列
