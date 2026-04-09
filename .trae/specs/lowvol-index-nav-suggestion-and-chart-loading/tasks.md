# Tasks
- [ ] Task 1: 图表区域 Loading 覆盖层（对标大盘看板）
  - [ ] 在低波机会图表容器外包一层 `relative` 容器
  - [ ] 当 `loading && !error` 时渲染 overlay（样式参考大盘看板 `MarketLiquidityPanel`）
  - [ ] 切换指数时确保 overlay 立即出现，数据返回后消失

- [ ] Task 2: 二级导航展示“操作建议”标签
  - [ ] 抽取/复用建议规则为纯函数（避免 Home 与 Panel 两处规则不一致）
  - [ ] 在低波机会二级导航每个指数项旁展示建议标签（颜色与文案统一）
  - [ ] 支持数据不足时展示 “—”

- [ ] Task 3: 数据加载策略（最小可用实现优先）
  - [ ] 方案A（默认）：使用现有 `/api/lowvol/index/:code` 拉取并取最新点计算建议（接受多次请求）
  - [ ] 方案B（可选增强）：新增轻量 summary API/函数，仅返回 latest 与建议所需字段（减少 payload）
  - [ ] 最终实现至少落地方案A，若落地方案B需保证不破坏现有接口

- [ ] Task 4: 验证与回归
  - [ ] 首次进入/切换指数时，图表区 overlay 展示与消失符合预期
  - [ ] 三个指数二级导航均展示建议标签，且与摘要卡/hover 的建议一致
  - [ ] `npm run check` 通过

# Task Dependencies
- Task 2 depends on Task 3
- Task 4 depends on Task 1-3

