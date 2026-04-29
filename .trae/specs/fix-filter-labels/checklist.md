# Checklist

## 标签不换行
- [x] TagGroup label span 含 `whitespace-nowrap`
- [x] StrategyTagGroup label span 含 `whitespace-nowrap`

## 策略名统一
- [x] Home.tsx 使用 `strategy.label`（"Baseline策略"、"基础颜色切换"）
- [x] DevTop200MomentumSignalsMock.tsx 同步使用 `strategy.label`

## 回归验证
- [x] `npm run check` 通过
- [x] `npm run build` 构建成功
