# Tasks

- [x] Task 1: 搭建 Mock 页面 `mock/momentum-analysis.html` — 独立 HTML 文件，内嵌新版 Hero 摘要 + 去边框 UI + 旧版对比区，使用内联模拟数据
  - [x] SubTask 1.1: 构建新版 Hero 摘要容器（Score `text-2xl` + RPS/MA50 中等字号 + 交易额辅助行）
  - [x] SubTask 1.2: 构建去边框化区块（标题、摘要、策略选择、成交额表格），使用 `shadow-md` 和 `bg` 背景差
  - [x] SubTask 1.3: 构建旧版对比区（10 张等权卡片 + 硬边框），用半透明遮罩标注「旧版风格」
  - [x] SubTask 1.4: 使用与线上一致的深色背景色板、字体、间距

- [x] Task 2: 重构 `customQuerySection` 摘要卡片为 Hero 主指标布局
  - [x] SubTask 2.1: 移除 `customQuerySection` 中 10 张独立 `SUMMARY_CARD_CLS` 卡片对应的 JSX 代码块 ([line 885-956](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/src/components/RpsStylePanel.tsx#L885-L956))
  - [x] SubTask 2.2: 新增 Hero 容器：标题行（标的名+代码 + 基准分母 + 截止日）+ 主指标行（Score `text-2xl` + RPS + MA50）+ 辅助指标行（交易额系列 `text-xs`）
  - [x] SubTask 2.3: 确保 `customQueryScoreState`、`customQueryDisplayLabel`、`customQueryBenchmarkLabel`、`customQueryLatest`、`customQueryLatestTurnoverSummary` 等现有变量正常引用
  - [x] SubTask 2.4: 确保 `customQueryLatest` 为 null 时不渲染 Hero 容器（保持现有 `DataStatusBanner` 逻辑）

- [x] Task 3: 全局去边框化 — 修改 `customQuerySection` 中各区块的 Tailwind 类名
  - [x] SubTask 3.1: 修改 `customQueryIntro` 标题横幅：[line 624](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/src/components/RpsStylePanel.tsx#L624) 去掉 `border border-[#1E293B]`，改为 `shadow-md`
  - [x] SubTask 3.2: 修改 Hero 容器：去掉所有 `border` 相关类名，用 `gap` + 背景色差区分子区域
  - [x] SubTask 3.3: 修改「关键图表指标」section：[line 958](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/src/components/RpsStylePanel.tsx#L958) 去掉 `border border-[rgba(248,250,252,0.08)]`
  - [x] SubTask 3.4: 修改「最近250个交易日成交额追踪」section：[line 1018](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/src/components/RpsStylePanel.tsx#L1018) 去掉外层 `border border-[#1E293B]`，保留内层表格行分割线

- [x] Task 4: 回归验证 — 确保不破坏现有功能
  - [x] SubTask 4.1: 运行 `npm run lint`（或项目 lint 命令），确保零新增告警
  - [x] SubTask 4.2: 运行 `npm run typecheck`（或项目类型检查命令），确保类型检查通过
  - [x] SubTask 4.3: 确认 `customQuerySection` 中所有现有变量引用未中断（`customQuerySummary`、`customQueryData`、`submittedCustomTicker` 等）
  - [x] SubTask 4.4: 确认搜索提交、策略切换、数据加载状态、错误状态均未受影响
  - [x] SubTask 4.5: 在浏览器中打开 Mock 页面与线上页面做视觉对比，确认 Hero 布局和去边框效果正确

- [x] Task 5: 检查 `refine-market-rps-custom-query-visual-polish` 和 `optimize-market-rps-custom-query-summary-layout` 相关 Spec 的兼容性
  - [x] SubTask 5.1: 确认本次修改不覆盖这两个 Spec 已完成的变更（覆盖行号未冲突）
  - [x] SubTask 5.2: 确认搜索栏样式（来自 `refine-market-rps-custom-query-visual-polish` Task3）保持不变

# Task Dependencies
- Task 2 和 Task 3 可以并行执行（修改同一文件的不同 JSX 区域）
- Task 1 独立，无依赖，可最先执行
- Task 4 依赖 Task 2 和 Task 3 完成
- Task 5 依赖 Task 2 和 Task 3 完成，可与 Task 4 并行
