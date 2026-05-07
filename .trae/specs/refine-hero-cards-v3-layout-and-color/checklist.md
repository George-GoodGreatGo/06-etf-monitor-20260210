# Checklist

- [x] `computeRsi` 初始化为数组头部数据（与图表 `buildRsi` 一致）
- [x] `computeRsi` 零增益零损失时返回 50
- [x] `resolveScoreState` 中 `score > 0` 使用红色系
- [x] `resolveScoreState` 中 `score < 0` 使用绿色系
- [x] 主指标行使用 `grid grid-cols-3 sm:grid-cols-6` 均分布局
- [x] Score 字号为 `text-xl`（原 `text-2xl`）
- [x] 其他主指标值字号为 `text-base`（原 `text-lg`）
- [x] Hero 容器 padding 为 `p-4`（原 `p-5`）
- [x] Score Badge 与 Score 值同行（非独立行）
- [x] 90日 Z 值为纯文本（无 `ZBadge`）
- [x] `tsc --noEmit` 零错误
- [x] `eslint RpsStylePanel.tsx` 零错误
- [x] Hero 仍在 `{customQueryLatest ? ... : null}` null guard 内
- [x] `ZBadge` 导入已安全移除（仅此文件无引用）
- [x] Mock HTML 与线上代码样式一致
