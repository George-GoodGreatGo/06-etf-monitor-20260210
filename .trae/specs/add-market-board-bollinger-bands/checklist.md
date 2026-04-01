# Checklist

- [ ] BOLL120 计算严格遵循：MB=SMA(close,N)，Std=样本标准差（n-1），UB/LB=MB±K*Std，Bandwidth=(UB-LB)/MB
- [ ] 输出长度与输入完全一致，前 N-1 天四项指标为缺失值（null/NaN 等价处理），不会引发运行时异常
- [ ] 主图新增 MB/UB/LB 三条曲线，并支持通过按钮显示/隐藏
- [ ] hover 信息在 BOLL 开启时展示 MB/UB/LB 与 Bandwidth，关闭时不显示
- [ ] `npm run check` 通过
- [ ] 不破坏现有主图/副图功能（EMA、红绿段、联动缩放、Tooltip）
