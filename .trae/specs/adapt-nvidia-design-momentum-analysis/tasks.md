# Tasks

- [ ] Task 0: 验证当前代码基线 — 运行 lint + typecheck，确认无既有错误
  - [ ] SubTask 0.1: `tsc --noEmit` 通过
  - [ ] SubTask 0.2: `eslint src/components/RpsStylePanel.tsx` 通过

- [ ] Task 1: P0 — 全局颜色变量映射 + 页面底色改为白色
  - [ ] SubTask 1.1: 在 `src/components/RpsStylePanel.tsx` 顶部定义颜色常量（如 `COLOR_PRIMARY = '#76b900'` 等），供 JSX 内 `style` 或动态 className 使用
  - [ ] SubTask 1.2: `PageContentContainer` 页面容器背景从深色改为白色（如不可改 → 在 `customQuerySection` 外层加 `bg-white` wrapper）
  - [ ] SubTask 1.3: `customQuerySection` 中所有区域的底色从暗色系列（`bg-[#0F172A]`、`bg-[rgba(11,18,32,...)]`）改为 `bg-white`
  - [ ] SubTask 1.4: 所有文字色从浅色（`text-[#F8FAFC]`、`text-[#E6EDF7]`、`text-[#CBD5E1]`）改为深色（`text-[#000000]`、`text-[#1a1a1a]`、`text-[#757575]`）
  - [ ] SubTask 1.5: 所有 `rounded-lg` → `rounded-sm`，`rounded-md` → `rounded-sm`，`rounded-xl` → `rounded-sm`（P0 全局圆角统一）

- [ ] Task 2: P1 — Hero 卡片扁平化 + 搜索栏矩形化
  - [ ] SubTask 2.1: Hero 容器 `bg-[#0F172A] p-4 shadow-md` → `bg-white border border-[#cccccc] p-6 rounded-sm`
  - [ ] SubTask 2.2: `resolveScoreState` 颜色修正：`score > 0` → `#76b900`，`score < 0` → `#e52020`
  - [ ] SubTask 2.3: `pctToneCls` 颜色修正：`v > 0` → `#e52020`（红涨），`v < 0` → `#3f8500`（绿跌）
  - [ ] SubTask 2.4: 主指标 grid 项内 `border-r border-white/10` → `border-r border-[#cccccc]`
  - [ ] SubTask 2.5: 副指标脚注文字色 `text-[#64748B]` → `text-[#757575]`，数值 `text-[#94A3B8]` → `text-[#757575]`
  - [ ] SubTask 2.6: 搜索栏 pillar `border-white/[0.07]` → `border-[#cccccc]`，`bg-white/[0.03]` → `bg-white`，`rounded-full` → `rounded-sm`
  - [ ] SubTask 2.7: 搜索栏高度 `min-h-[56px]` → `h-[44px]`
  - [ ] SubTask 2.8: 查询按钮 `bg-[linear-gradient(...)]` → `bg-[#76b900] text-[#000000] rounded-sm h-[44px]`
  - [ ] SubTask 2.9: 标题横幅 `text-white` → `text-[#000000]`，副标题 `text-[#94A3B8]` → `text-[#757575]`
  - [ ] SubTask 2.10: Hero 标题行文字颜色适配浅色底

- [ ] Task 3: P2 — 策略选择区 + 成交额表格浅色化
  - [ ] SubTask 3.1: 策略选择区 section `bg-[rgba(11,18,32,0.82)] shadow-sm` → `bg-white border border-[#cccccc] rounded-sm`
  - [ ] SubTask 3.2: 策略选择区标题 `text-[#F8FAFC]` → `text-[#000000]`，描述文字 `text-[#94A3B8]` → `text-[#757575]`
  - [ ] SubTask 3.3: 策略 pills 外层 `rounded-2xl border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.82)]` → `rounded-sm border-[#cccccc] bg-white`
  - [ ] SubTask 3.4: 策略 pill 激活态 `bg-[linear-gradient(...)] text-white` → `bg-[#000000] text-white rounded-sm`
  - [ ] SubTask 3.5: 策略 pill 非激活态文字色改为 `text-[#1a1a1a]`
  - [ ] SubTask 3.6: 信号图例 badge 文字色适配浅色背景
  - [ ] SubTask 3.7: 成交额追踪 section `shadow-md rounded-lg` → `border border-[#cccccc] rounded-sm bg-white`
  - [ ] SubTask 3.8: 成交额表头 `bg-white/5 text-[#A9B6CC]` → `bg-[#f7f7f7] text-[#000000]`
  - [ ] SubTask 3.9: 成交额表格行文字 `text-[#E6EDF7]` / `text-[#A9B6CC]` → `text-[#1a1a1a]` / `text-[#757575]`
  - [ ] SubTask 3.10: 放量高亮行 `bg-[rgba(203,184,255,0.10)]` → `bg-[#f7f7f7]`，文字 `text-[#CBB8FF]` → `text-[#76b900]`
  - [ ] SubTask 3.11: 成交额表格外层 div `border border-[#1E293B] bg-[#0B1220]` → `border border-[#cccccc] bg-white`

- [ ] Task 4: 同步更新 Mock HTML `mock/momentum-analysis.html`
  - [ ] SubTask 4.1: 页面背景 `#0B1220` → `#ffffff`
  - [ ] SubTask 4.2: Hero、搜索栏、策略区、成交额表格全部同步为 NVIDIA 样式
  - [ ] SubTask 4.3: 旧版对比区保留（方便对比，标注"旧版暗色风格"）

- [ ] Task 5: 回归验证
  - [ ] SubTask 5.1: `tsc --noEmit` 零错误
  - [ ] SubTask 5.2: `eslint src/components/RpsStylePanel.tsx` 零错误
  - [ ] SubTask 5.3: 搜索提交、策略切换、图表渲染、数据加载状态均未受影响
  - [ ] SubTask 5.4: Hero 卡片的 `{customQueryLatest ? ... : null}` null guard 完好

# Task Dependencies
- Task 1 (P0) 必须先于 Task 2 和 Task 3（全局底色和文字色变更影响所有区域）
- Task 2 (P1) 和 Task 3 (P2) 可在 Task 1 完成后并行
- Task 4 依赖 Task 1、2、3 完成
- Task 5 依赖 Task 1、2、3、4 完成
