# Tasks

- [x] Task 1: ZBadge 增加颜色分级
  - [x] 根据 `|z|` 绝对值映射四种颜色方案：红(≥2.58)、橙(1.96~2.58)、蓝(1.65~1.96)、灰(<1.65)
  - [x] `z == null` 时显示 `—` 保持灰色徽章
  - [x] `status !== 'complete'` 时保持现有行为不变
  - [x] 颜色值参考现有信号 Badge 风格，保持视觉一致性

- [x] Task 2: 列头简化 + Tooltip
  - [x] Top100Table.tsx 中列头文案简化：`今日成交量(份)`→`成交量`、`今日成交额(元)`→`成交额`、`成交额较昨%`→`较昨±`、`成交额较7日均%`→`较7日均±`
  - [x] SortableTh.tsx 增加可选 `title` prop，渲染时设置按钮的 `title` 属性
  - [x] Top100Table.tsx 中给简化后的列头传入对应 `title` 完整说明

- [x] Task 3: 表格斑马纹
  - [x] Top100Table.tsx 中 tbody 数据行 `<tr>` 增加 `even:bg-[rgba(255,255,255,0.02)]`
  - [x] 验证 hover 效果在斑马行上仍正常显示
  - [x] loading skeleton 行不添加斑马纹

- [x] Task 4: 底部状态栏文案修正
  - [x] Top100Table.tsx 中将 `正在显示 ${data.length} 条数据（滚动查看更多）` 改为 `共 ${data.length} 条记录`
  - [x] `data.length === 0` 时不显示底部状态栏

- [x] Task 5: Hover 效果增强
  - [x] Top100Table.tsx 中数据行 `hover:bg-[#1E293B]` 改为 `hover:bg-[rgba(255,87,34,0.06)]`
  - [x] 增加 `transition-colors duration-150` 实现平滑过渡

- [x] Task 6: 信号 Badge 对比度增强
  - [x] Top100Table.tsx 中 `renderSignalCell` 函数更新三种信号的颜色值
  - [x] buy: 文字 `#FECACA`，背景 `rgba(127,29,29,0.35)`，边框 `rgba(248,113,113,0.35)`
  - [x] sell: 文字 `#BBF7D0`，背景 `rgba(6,78,59,0.35)`，边框 `rgba(16,185,129,0.35)`
  - [x] risk_sell: 文字 `#FDE68A`，背景 `rgba(120,53,15,0.35)`，边框 `rgba(251,191,36,0.35)`

- [x] Task 7: 回归验证
  - [x] `npm run check`（lint + typecheck）通过，无新增告警
  - [x] `npm run build` 构建成功

# Task Dependencies
- Task 1–6 互相独立，可并行执行
- Task 7 依赖 Task 1–6 全部完成
